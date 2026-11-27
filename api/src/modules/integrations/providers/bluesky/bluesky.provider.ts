import { Injectable } from '@nestjs/common';
import { type Client, currentDatetimeString } from '@atproto/lex';
import type { AtUriString } from '@atproto/syntax';
import { post } from '@bsky/sdk';
import { app } from '@bsky/sdk/lexicons';
import { RichText } from '@bsky/sdk/richtext';
import { Platform } from '../../../../common/enums/platform.enum.js';
import type {
  PlatformProvider,
  PostMetrics,
  ProviderCapabilities,
  PublishInput,
  PublishResult,
  VerifiedAccount,
} from '../../interfaces/platform-provider.interface.js';
import { LinkPreviewService } from '../../link-preview/link-preview.service.js';
import { parseCredentialsDto } from '../../parse-credentials.js';
import { BlueskyClientFactory } from './bluesky-client.js';
import { BlueskyCredentialsDto } from './bluesky-credentials.dto.js';

// getPosts accepts at most 25 URIs per call.
const GET_POSTS_BATCH = 25;

type External = Parameters<
  typeof app.bsky.embed.external.$build
>[0]['external'];
type ExternalEmbed = ReturnType<typeof app.bsky.embed.external.$build>;

/** Bluesky through the official SDK (`@bsky/sdk` + `@atproto/lex`). */
@Injectable()
export class BlueskyProvider implements PlatformProvider<BlueskyCredentialsDto> {
  readonly platform = Platform.Bluesky;
  readonly displayName = 'Bluesky';
  readonly capabilities: ProviderCapabilities = {
    maxTextLength: 300,
    lengthUnit: 'graphemes',
    supportsMetrics: true,
    contentStyle:
      'Short, conversational text post. Links, @mentions and #hashtags become clickable, and the first link gets a preview card.',
    connect: 'credentials',
  };

  constructor(
    private readonly clients: BlueskyClientFactory,
    private readonly previews: LinkPreviewService,
  ) {}

  parseCredentials(raw: unknown): Promise<BlueskyCredentialsDto> {
    return parseCredentialsDto(BlueskyCredentialsDto, raw);
  }

  async verify(credentials: BlueskyCredentialsDto): Promise<VerifiedAccount> {
    await this.clients.login(credentials);
    return this.clients.withClient(credentials, async (client, session) => {
      const profile = await client.call(app.bsky.actor.getProfile, {
        actor: session.did,
      });
      return {
        externalId: profile.did,
        handle: profile.handle,
        displayName: profile.displayName || profile.handle,
        profileUrl: `https://bsky.app/profile/${profile.handle}`,
        avatarUrl: profile.avatar,
      };
    });
  }

  publish(
    credentials: BlueskyCredentialsDto,
    input: PublishInput,
  ): Promise<PublishResult> {
    return this.clients.withClient(credentials, async (client, session) => {
      const rt = new RichText({ text: input.text });
      await rt.detectFacets(client);
      const embed = await this.linkCard(client, rt);
      const createdAt = currentDatetimeString();
      const { uri } = await client.call(post, {
        text: rt.text,
        createdAt,
        ...(rt.facets?.length && { facets: rt.facets }),
        ...(embed && { embed }),
      });
      const rkey = uri.split('/').pop();
      return {
        externalId: uri,
        externalUrl: `https://bsky.app/profile/${session.handle}/post/${rkey}`,
        publishedAt: new Date(createdAt),
      };
    });
  }

  fetchMetrics(
    credentials: BlueskyCredentialsDto,
    externalIds: string[],
  ): Promise<Map<string, PostMetrics>> {
    return this.clients.withClient(credentials, async (client) => {
      const result = new Map<string, PostMetrics>();
      for (let i = 0; i < externalIds.length; i += GET_POSTS_BATCH) {
        // Every id we stored came back from createRecord, so it is an AT URI.
        const uris = externalIds.slice(i, i + GET_POSTS_BATCH) as AtUriString[];
        const { posts } = await client.call(app.bsky.feed.getPosts, { uris });
        for (const p of posts) {
          result.set(p.uri, {
            likes: p.likeCount,
            reposts: p.repostCount,
            replies: p.replyCount,
            quotes: p.quoteCount,
            raw: {
              likeCount: p.likeCount,
              repostCount: p.repostCount,
              replyCount: p.replyCount,
              quoteCount: p.quoteCount,
              bookmarkCount: p.bookmarkCount,
            },
          });
        }
      }
      return result;
    });
  }

  disconnect(credentials: BlueskyCredentialsDto): Promise<void> {
    return this.clients.logout(credentials);
  }

  // Bluesky doesn't unfurl links itself: the posting client embeds the card.
  private async linkCard(
    client: Client,
    rt: RichText,
  ): Promise<ExternalEmbed | undefined> {
    const link = [...rt.segments()].find((s) => s.isLink())?.link?.uri;
    if (!link) return undefined;
    const preview = await this.previews.fetch(link);
    if (!preview) return undefined;
    let thumb: External['thumb'];
    if (preview.image) {
      const { body } = await client.uploadBlob(preview.image.data, {
        encoding: preview.image.mimeType,
      });
      thumb = body.blob;
    }
    return app.bsky.embed.external.$build({
      external: {
        // Parsed by `new URL()` in the preview service, so it is a valid URI.
        uri: preview.url as External['uri'],
        title: preview.title.slice(0, 300),
        description: preview.description.slice(0, 1000),
        ...(thumb && { thumb }),
      },
    });
  }
}
