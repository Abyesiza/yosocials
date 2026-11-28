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
import { XApi } from './x-api.js';
import { XMediaUploader } from './x-media.js';
import type { XPost, XUser } from './x.types.js';

/** Stored per account. The OAuth tokens live in the session store under the user id. */
export interface XCredentials {
  userId: string;
}

const MAX_IMAGES = 4;
/** X's limit for photos; videos are capped lower by our own upload limit. */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const LOOKUP_BATCH = 100;
const POST_ID = /^\d{1,19}$/;

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
    connect: 'oauth',
    media: { required: false, video: true, maxImages: MAX_IMAGES },
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
    const images = media.filter((m) => m.kind === 'image');
    if (images.length > MAX_IMAGES)
      issues.push(`X takes up to ${MAX_IMAGES} photos in a post.`);
    if (images.some((m) => m.size > MAX_IMAGE_BYTES)) {
      issues.push('X takes photos up to 5 MB. Use a smaller photo.');
    }
    return issues;
  }

  async publish(
    { userId }: XCredentials,
    input: PublishInput,
  ): Promise<PublishResult> {
    const issues = this.readinessIssues(input);
    if (issues.length > 0) throw new BadRequestException(`X: ${issues[0]}`);

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
          `${error.message}. It may have reached X, so check the profile before retrying.`,
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
