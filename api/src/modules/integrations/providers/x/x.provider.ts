import { BadRequestException, Injectable } from '@nestjs/common';
import { Platform } from '../../../../common/enums/platform.enum.js';
import { PlatformApiError } from '../../../../common/http/http-client.js';
import type {
  OAuthConnector,
  PlatformProvider,
  PostMetrics,
  ProviderCapabilities,
  PublishInput,
  PublishResult,
  ReadinessInput,
  VerifiedAccount,
} from '../../interfaces/platform-provider.interface.js';
import { mediaIssues } from '../../media-spec.js';
import { XApi } from './x-api.js';
import { XMediaUploader } from './x-media.js';
import type { XPost, XUser } from './x.types.js';

/** Stored per account. The OAuth tokens live in the session store under the user id. */
export interface XCredentials {
  userId: string;
}

const MAX_IMAGES = 4;
const LOOKUP_BATCH = 100;
const POST_ID = /^\d{1,19}$/;

const ALL = [0, 1, 2, 3, 4, 5, 6];

@Injectable()
export class XProvider implements PlatformProvider<XCredentials> {
  readonly platform = Platform.X;
  readonly displayName = 'X';
  readonly capabilities: ProviderCapabilities = {
    // 280 for accounts without X Premium, which is the safe limit for everyone.
    maxTextLength: 280,
    lengthUnit: 'weighted',
    supportsMetrics: true,
    // Every read is billed, so check X less often than free platforms.
    metricsIntervalMinutes: 360,
    contentStyle:
      'A short, punchy post. Lead with the point, one idea per post, 0 to 2 #hashtags. Length is weighted: links count as 23, emoji and CJK characters as 2.',
    // Buffer 2026 (8.7M posts) and Hootsuite 2025: weekday mornings; Sprout 2026: weekday midday.
    posting: {
      maxPerDay: 3,
      minSpacingMinutes: 120,
      windows: [
        { days: [2, 3, 4], start: '08:00', end: '11:00', weight: 3 },
        { days: [1, 5], start: '08:00', end: '11:00', weight: 2 },
        { days: [1, 2, 3, 4], start: '12:00', end: '17:00', weight: 1 },
      ],
      avoid: [
        { days: ALL, start: '22:00', end: '24:00', weight: 1 },
        { days: ALL, start: '00:00', end: '07:00', weight: 1 },
        { days: [6], start: '00:00', end: '24:00', weight: 1 },
      ],
      source:
        'Buffer 2026, Hootsuite 2025 and Sprout Social 2026 studies of X posts',
      limits: [
        '100 posts per 15 minutes per user, 10,000 per day per app (X API)',
        'Each post is billed: $0.015, or $0.20 with a link',
      ],
    },
    connect: 'oauth',
    // docs.x.com/x-api/media/quickstart/best-practices (checked 2026-11-28).
    media: {
      required: false,
      video: true,
      maxImages: MAX_IMAGES,
      imageSpec: {
        types: ['image/jpeg', 'image/png', 'image/webp'],
        maxBytes: 5_000_000,
        maxLongSide: 4096,
        maxShortSide: 4096,
      },
      videoSpec: {
        types: ['video/mp4'],
        codecs: ['avc'],
        maxBytes: 512 * 1024 * 1024,
        minDurationSec: 0.5,
        maxDurationSec: 20 * 60,
        // The documented bound; larger sizes are only promised to subscribers.
        maxLongSide: 1280,
        maxShortSide: 1024,
        minShortSide: 32,
        maxFps: 60,
        aspect: { min: 1 / 3, max: 3 },
      },
    },
  };

  readonly oauth: OAuthConnector;

  constructor(
    private readonly api: XApi,
    private readonly uploader: XMediaUploader,
  ) {
    this.oauth = {
      isConfigured: () => api.isConfigured(),
      authorizeUrl: (state, codeVerifier) =>
        api.authorizeUrl(state, codeVerifier),
      exchange: async (code, codeVerifier) => ({
        userId: await api.exchangeCode(code, codeVerifier),
      }),
    };
  }

  parseCredentials(): Promise<XCredentials> {
    return Promise.reject(
      new BadRequestException(
        'X connects with “Continue with X”; there is nothing to paste.',
      ),
    );
  }

  async verify({ userId }: XCredentials): Promise<VerifiedAccount> {
    const { data: user } = await this.api.call<XUser>(userId, '/2/users/me', {
      query: { 'user.fields': 'profile_image_url' },
    });
    return {
      externalId: user!.id,
      handle: `@${user!.username}`,
      displayName: user!.name || user!.username,
      profileUrl: `https://x.com/${user!.username}`,
      avatarUrl: user!.profile_image_url,
    };
  }

  readinessIssues({ text, media }: ReadinessInput): string[] {
    const issues: string[] = [];
    if (!text.trim() && media.length === 0)
      issues.push('write something or attach media.');
    return issues;
  }

  async publish(
    { userId }: XCredentials,
    input: PublishInput,
  ): Promise<PublishResult> {
    const issues = [
      ...mediaIssues(input.media, this.capabilities.media),
      ...this.readinessIssues(input),
    ];
    if (issues.length > 0)
      throw new BadRequestException(`To post to X, ${issues[0]}`);

    const mediaIds = await this.uploader.upload(userId, input.media);
    const body = {
      ...(input.text.trim() && { text: input.text }),
      ...(mediaIds.length > 0 && { media: { media_ids: mediaIds } }),
    };
    try {
      const { data } = await this.api.call<{ id: string }>(
        userId,
        '/2/tweets',
        { json: body },
      );
      return {
        externalId: data!.id,
        // Works without knowing the handle, and survives username changes.
        externalUrl: `https://x.com/i/web/status/${data!.id}`,
        publishedAt: new Date(),
      };
    } catch (error) {
      // X has no idempotency keys: a request that timed out may have landed.
      if (error instanceof PlatformApiError && error.status === 0) {
        throw new PlatformApiError(
          'We lost contact with X while sending this. It may have been posted, so check the profile before you try again.',
          0,
          false,
        );
      }
      throw error;
    }
  }

  async fetchMetrics(
    { userId }: XCredentials,
    externalIds: string[],
  ): Promise<Map<string, PostMetrics>> {
    const result = new Map<string, PostMetrics>();
    const ids = externalIds.filter((id) => POST_ID.test(id));
    for (let i = 0; i < ids.length; i += LOOKUP_BATCH) {
      const { data = [], includes } = await this.api.call<XPost[]>(
        userId,
        '/2/tweets',
        {
          query: {
            ids: ids.slice(i, i + LOOKUP_BATCH).join(','),
            // Private metrics cover our own posts from the last 30 days, as tracked.
            'post.fields': 'public_metrics,non_public_metrics,organic_metrics',
            expansions: 'attachments.media_keys',
            'media.fields': 'public_metrics',
          },
        },
      );
      const videoViews = new Map(
        (includes?.media ?? []).map((m) => [
          m.media_key,
          m.public_metrics?.view_count,
        ]),
      );
      for (const post of data) {
        const m = post.public_metrics;
        if (!m) continue;
        const views = post.attachments?.media_keys
          ?.map((key) => videoViews.get(key))
          .find((v) => v !== undefined);
        result.set(post.id, {
          likes: m.like_count,
          reposts: m.repost_count,
          replies: m.reply_count,
          quotes: m.quote_count,
          // X shows impressions as a post's "views".
          views: m.impression_count,
          raw: {
            public_metrics: m,
            non_public_metrics: post.non_public_metrics,
            organic_metrics: post.organic_metrics,
            video_view_count: views,
          },
        });
      }
    }
    return result;
  }

  disconnect({ userId }: XCredentials): Promise<void> {
    return this.api.revoke(userId);
  }
}
