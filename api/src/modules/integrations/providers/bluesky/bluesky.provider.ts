import { Injectable } from '@nestjs/common';
import { Platform } from '../../../../common/enums/platform.enum.js';
import {
  PlatformApiError,
  requestJson,
} from '../../../../common/http/http-client.js';
import type {
  PlatformProvider,
  PostMetrics,
  ProviderCapabilities,
  PublishInput,
  PublishResult,
  VerifiedAccount,
} from '../../interfaces/platform-provider.interface.js';
import { parseCredentialsDto } from '../../parse-credentials.js';
import { BlueskyCredentialsDto } from './bluesky-credentials.dto.js';
import { detectFacets } from './bluesky-facets.js';
import type {
  BlueskyCreateRecordResponse,
  BlueskyFacet,
  BlueskyGetPostsResponse,
  BlueskyProfile,
  BlueskySession,
} from './bluesky.types.js';

const DEFAULT_SERVICE = 'https://bsky.social';
/** Public AppView: reads (profiles, post counts) need no auth. */
const APPVIEW = 'https://public.api.bsky.app';
const GET_POSTS_BATCH = 25;
/** Access JWTs live ~2h; reuse sessions well inside that window. */
const SESSION_TTL_MS = 60 * 60 * 1000;

/**
 * Bluesky via the AT Protocol XRPC API. createSession is rate limited
 * (~30 per 5 min per account), so sessions are cached in memory.
 */
@Injectable()
export class BlueskyProvider implements PlatformProvider<BlueskyCredentialsDto> {
  readonly platform = Platform.Bluesky;
  readonly displayName = 'Bluesky';
  readonly capabilities: ProviderCapabilities = {
    maxTextLength: 300,
    lengthUnit: 'graphemes',
    supportsMetrics: true,
    contentStyle:
      'Short, conversational text post. Links and #hashtags become clickable.',
  };

  private readonly sessions = new Map<
    string,
    { session: BlueskySession; expiresAt: number }
  >();

  parseCredentials(raw: unknown): Promise<BlueskyCredentialsDto> {
    return parseCredentialsDto(BlueskyCredentialsDto, raw);
  }

  async verify(credentials: BlueskyCredentialsDto): Promise<VerifiedAccount> {
    const session = await this.getSession(credentials, true);
    const profile = await requestJson<BlueskyProfile>(
      `${APPVIEW}/xrpc/app.bsky.actor.getProfile`,
      { query: { actor: session.did } },
    );
    return {
      externalId: profile.did,
      handle: profile.handle,
      displayName: profile.displayName || profile.handle,
      profileUrl: `https://bsky.app/profile/${profile.handle}`,
      avatarUrl: profile.avatar,
    };
  }

  async publish(
    credentials: BlueskyCredentialsDto,
    input: PublishInput,
  ): Promise<PublishResult> {
    const session = await this.getSession(credentials);
    const createdAt = new Date();
    const facets = await this.buildFacets(input.text);

    const record = {
      $type: 'app.bsky.feed.post',
      text: input.text,
      createdAt: createdAt.toISOString(),
      ...(facets.length > 0 && { facets }),
    };

    const created = await this.withSessionRetry(credentials, session, (s) =>
      requestJson<BlueskyCreateRecordResponse>(
        `${this.service(credentials)}/xrpc/com.atproto.repo.createRecord`,
        {
          headers: { authorization: `Bearer ${s.accessJwt}` },
          json: { repo: s.did, collection: 'app.bsky.feed.post', record },
        },
      ),
    );

    const rkey = created.uri.split('/').pop();
    return {
      externalId: created.uri,
      externalUrl: `https://bsky.app/profile/${session.handle}/post/${rkey}`,
      publishedAt: createdAt,
    };
  }

  async fetchMetrics(
    _credentials: BlueskyCredentialsDto,
    externalIds: string[],
  ): Promise<Map<string, PostMetrics>> {
    const result = new Map<string, PostMetrics>();
    for (let i = 0; i < externalIds.length; i += GET_POSTS_BATCH) {
      const { posts } = await requestJson<BlueskyGetPostsResponse>(
        `${APPVIEW}/xrpc/app.bsky.feed.getPosts`,
        { query: { uris: externalIds.slice(i, i + GET_POSTS_BATCH) } },
      );
      for (const post of posts) {
        result.set(post.uri, {
          likes: post.likeCount,
          reposts: post.repostCount,
          replies: post.replyCount,
          quotes: post.quoteCount,
          raw: { ...post },
        });
      }
    }
    return result;
  }

  private service(credentials: BlueskyCredentialsDto): string {
    return (credentials.service ?? DEFAULT_SERVICE).replace(/\/$/, '');
  }

  private async getSession(
    credentials: BlueskyCredentialsDto,
    forceNew = false,
  ): Promise<BlueskySession> {
    const key = `${this.service(credentials)}|${credentials.identifier}`;
    const cached = this.sessions.get(key);
    if (!forceNew && cached && cached.expiresAt > Date.now()) {
      return cached.session;
    }
    const session = await requestJson<BlueskySession>(
      `${this.service(credentials)}/xrpc/com.atproto.server.createSession`,
      {
        json: {
          identifier: credentials.identifier,
          password: credentials.appPassword,
        },
      },
    );
    this.sessions.set(key, { session, expiresAt: Date.now() + SESSION_TTL_MS });
    return session;
  }

  /** Retries once with a fresh session if the cached token was rejected. */
  private async withSessionRetry<T>(
    credentials: BlueskyCredentialsDto,
    session: BlueskySession,
    call: (session: BlueskySession) => Promise<T>,
  ): Promise<T> {
    try {
      return await call(session);
    } catch (error) {
      if (error instanceof PlatformApiError && error.status === 401) {
        return call(await this.getSession(credentials, true));
      }
      throw error;
    }
  }

  private async buildFacets(text: string): Promise<BlueskyFacet[]> {
    const { facets, mentions } = detectFacets(text);
    for (const mention of mentions) {
      try {
        const { did } = await requestJson<{ did: string }>(
          `${APPVIEW}/xrpc/com.atproto.identity.resolveHandle`,
          { query: { handle: mention.handle } },
        );
        facets.push({
          index: mention.index,
          features: [{ $type: 'app.bsky.richtext.facet#mention', did }],
        });
      } catch {
        // Unknown handle: leave it as plain text rather than fail the post.
      }
    }
    return facets.sort((a, b) => a.index.byteStart - b.index.byteStart);
  }
}
