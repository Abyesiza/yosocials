import { BadRequestException, Injectable } from '@nestjs/common';
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
  ReadinessInput,
  VerifiedAccount,
} from '../../interfaces/platform-provider.interface.js';
import { mediaIssues } from '../../media-spec.js';
import { parseCredentialsDto } from '../../parse-credentials.js';
import { MastodonCredentialsDto } from './mastodon-credentials.dto.js';
import { instanceIssue, uploadMedia } from './mastodon-media.js';
import type { MastodonAccount, MastodonStatus } from './mastodon.types.js';

@Injectable()
export class MastodonProvider implements PlatformProvider<MastodonCredentialsDto> {
  readonly platform = Platform.Mastodon;
  readonly displayName = 'Mastodon';
  readonly capabilities: ProviderCapabilities = {
    // 500 is the Mastodon default; some instances allow more.
    maxTextLength: 500,
    lengthUnit: 'characters',
    supportsMetrics: true,
    contentStyle:
      'Text post (a "toot"). Community prefers CamelCase #hashtags and content warnings for sensitive topics.',
    connect: 'credentials',
    // Mastodon's defaults (docs.joinmastodon.org/entities/Instance/, checked 2026-11-28); servers may lower them.
    media: {
      required: false,
      video: true,
      maxImages: 4,
      imageSpec: {
        types: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        maxBytes: 16_777_216,
        maxLongSide: 8192,
        maxShortSide: 8192,
        maxPixels: 33_177_600,
      },
      // The server transcodes video, so more codecs can go up as they are.
      videoSpec: {
        types: ['video/mp4', 'video/webm', 'video/quicktime'],
        codecs: ['avc', 'vp8', 'vp9', 'hevc'],
        maxBytes: 103_809_024,
        maxLongSide: 4096,
        maxShortSide: 4096,
        maxPixels: 8_294_400,
        maxFps: 120,
      },
    },
  };

  parseCredentials(raw: unknown): Promise<MastodonCredentialsDto> {
    return parseCredentialsDto(MastodonCredentialsDto, raw);
  }

  async verify(credentials: MastodonCredentialsDto): Promise<VerifiedAccount> {
    const account = await requestJson<MastodonAccount>(
      this.url(credentials, '/api/v1/accounts/verify_credentials'),
      { headers: this.auth(credentials) },
    );
    const domain = new URL(credentials.instanceUrl).host;
    return {
      externalId: account.id,
      handle: `@${account.username}@${domain}`,
      displayName: account.display_name || account.username,
      profileUrl: account.url,
      avatarUrl: account.avatar,
    };
  }

  readinessIssues({ text, media }: ReadinessInput): string[] {
    return !text.trim() && media.length === 0
      ? ['write something or attach media.']
      : [];
  }

  async publish(
    credentials: MastodonCredentialsDto,
    input: PublishInput,
  ): Promise<PublishResult> {
    const base = this.url(credentials, '');
    const issue =
      mediaIssues(input.media, this.capabilities.media)[0] ??
      this.readinessIssues(input)[0] ??
      (input.media.length > 0 && (await instanceIssue(base, input.media)));
    if (issue) throw new BadRequestException(`To post to Mastodon, ${issue}`);

    const mediaIds = await uploadMedia(
      base,
      this.auth(credentials),
      input.media,
    );
    const status = await requestJson<MastodonStatus>(
      this.url(credentials, '/api/v1/statuses'),
      {
        headers: {
          ...this.auth(credentials),
          // Mastodon drops duplicate submissions with the same key for 1 hour.
          'idempotency-key': input.idempotencyKey,
        },
        json: {
          status: input.text,
          visibility: 'public',
          ...(mediaIds.length > 0 && { media_ids: mediaIds }),
        },
      },
    );
    return {
      externalId: status.id,
      externalUrl: status.url ?? undefined,
      publishedAt: new Date(status.created_at),
    };
  }

  async fetchMetrics(
    credentials: MastodonCredentialsDto,
    externalIds: string[],
  ): Promise<Map<string, PostMetrics>> {
    const result = new Map<string, PostMetrics>();
    for (const id of externalIds) {
      try {
        const s = await requestJson<MastodonStatus>(
          this.url(credentials, `/api/v1/statuses/${encodeURIComponent(id)}`),
          { headers: this.auth(credentials) },
        );
        result.set(id, {
          likes: s.favourites_count,
          reposts: s.reblogs_count,
          replies: s.replies_count,
          quotes: s.quotes_count,
          raw: {
            favourites_count: s.favourites_count,
            reblogs_count: s.reblogs_count,
            replies_count: s.replies_count,
            quotes_count: s.quotes_count,
          },
        });
      } catch (error) {
        // A deleted status shouldn't stop metrics for the rest.
        if (error instanceof PlatformApiError && error.status === 404) continue;
        throw error;
      }
    }
    return result;
  }

  private url(credentials: MastodonCredentialsDto, path: string): string {
    return `${credentials.instanceUrl.replace(/\/$/, '')}${path}`;
  }

  private auth(credentials: MastodonCredentialsDto): Record<string, string> {
    return { authorization: `Bearer ${credentials.accessToken}` };
  }
}
