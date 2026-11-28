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
import { LinkedInApi } from './linkedin-api.js';
import { LinkedInMediaUploader } from './linkedin-media.js';
import { toLittleText } from './linkedin-text.js';
import type {
  LinkedInMetricType,
  LinkedInPostAnalytics,
} from './linkedin.types.js';

/** Stored per account. The OAuth tokens live in the session store under the member id. */
export interface LinkedInCredentials {
  memberId: string;
}

const MAX_IMAGES = 20;
const POST_URN = /^urn:li:(share|ugcPost):\d+$/;
const ANALYTICS_SCOPE = 'r_member_postAnalytics';
const METRICS: LinkedInMetricType[] = [
  'IMPRESSION',
  'REACTION',
  'COMMENT',
  'RESHARE',
];

@Injectable()
export class LinkedInProvider implements PlatformProvider<LinkedInCredentials> {
  readonly platform = Platform.LinkedIn;
  readonly displayName = 'LinkedIn';
  readonly capabilities: ProviderCapabilities = {
    maxTextLength: 3000,
    lengthUnit: 'characters',
    supportsMetrics: true,
    // Four analytics calls per post, under LinkedIn's daily limits.
    metricsIntervalMinutes: 360,
    contentStyle:
      'A professional post for LinkedIn: a strong first line (only about 200 characters show before “see more”), short paragraphs, a clear takeaway or question, and 3 to 5 #hashtags at the end.',
    connect: 'oauth',
    // Images, Videos and MultiImage APIs, and LinkedIn Help a548372 (organic video), checked 2026-11-28.
    media: {
      required: false,
      video: true,
      maxImages: MAX_IMAGES,
      imageSpec: {
        types: ['image/jpeg', 'image/png', 'image/gif'],
        maxBytes: 16 * 1024 * 1024,
        maxLongSide: 8192,
        maxShortSide: 8192,
        maxPixels: 36_152_319,
      },
      videoSpec: {
        types: ['video/mp4'],
        codecs: ['avc'],
        maxBytes: 500 * 1024 * 1024,
        minDurationSec: 3,
        // The API allows 30 minutes, but LinkedIn Help says 15 for organic posts.
        maxDurationSec: 15 * 60,
        maxLongSide: 4096,
        maxShortSide: 2304,
        minShortSide: 144,
        minFps: 10,
        maxFps: 60,
        aspect: { min: 1 / 2.4, max: 2.4 },
      },
    },
  };

  readonly oauth: OAuthConnector;

  constructor(
    private readonly api: LinkedInApi,
    private readonly uploader: LinkedInMediaUploader,
  ) {
    this.oauth = {
      isConfigured: () => api.isConfigured(),
      authorizeUrl: (state) => api.authorizeUrl(state),
      exchange: async (code) => ({ memberId: await api.exchangeCode(code) }),
    };
  }

  parseCredentials(): Promise<LinkedInCredentials> {
    return Promise.reject(
      new BadRequestException(
        'LinkedIn connects with “Continue with LinkedIn”, so there’s nothing to paste.',
      ),
    );
  }

  async verify({ memberId }: LinkedInCredentials): Promise<VerifiedAccount> {
    const user = await this.api.userInfo(await this.api.accessToken(memberId));
    const name =
      user.name ||
      [user.given_name, user.family_name].filter(Boolean).join(' ') ||
      'LinkedIn member';
    // OpenID Connect gives no vanity URL, so there's no profile link to show.
    return {
      externalId: user.sub,
      handle: name,
      displayName: name,
      avatarUrl: user.picture,
    };
  }

  readinessIssues({ text, media }: ReadinessInput): string[] {
    const issues: string[] = [];
    if (!text.trim() && media.length === 0)
      issues.push('write something or attach media.');
    return issues;
  }

  async publish(
    { memberId }: LinkedInCredentials,
    input: PublishInput,
  ): Promise<PublishResult> {
    const issues = [
      ...mediaIssues(input.media, this.capabilities.media),
      ...this.readinessIssues(input),
    ];
    if (issues.length > 0)
      throw new BadRequestException(`To post to LinkedIn, ${issues[0]}`);

    const urns = await this.uploader.upload(memberId, input.media);
    const body = {
      author: `urn:li:person:${memberId}`,
      commentary: toLittleText(input.text),
      visibility: 'PUBLIC',
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
      ...(urns.length === 1 && { content: { media: { id: urns[0] } } }),
      ...(urns.length > 1 && {
        content: { multiImage: { images: urns.map((id) => ({ id })) } },
      }),
    };
    try {
      const { headers } = await this.api.call(memberId, '/rest/posts', {
        json: body,
      });
      const urn = headers.get('x-restli-id');
      if (!urn) {
        throw new PlatformApiError(
          'LinkedIn didn’t confirm the post. Check the profile before you try again.',
          502,
          false,
        );
      }
      return {
        externalId: urn,
        externalUrl: `https://www.linkedin.com/feed/update/${urn}/`,
        publishedAt: new Date(),
      };
    } catch (error) {
      // LinkedIn has no idempotency keys: a request that timed out may have landed.
      if (error instanceof PlatformApiError && error.status === 0) {
        throw new PlatformApiError(
          'We lost contact with LinkedIn while sending this. It may have been posted, so check the profile before you try again.',
          0,
          false,
        );
      }
      throw error;
    }
  }

  /** Needs r_member_postAnalytics (Community Management API); without it there's nothing to read. */
  async fetchMetrics(
    { memberId }: LinkedInCredentials,
    externalIds: string[],
  ): Promise<Map<string, PostMetrics>> {
    const result = new Map<string, PostMetrics>();
    if (!(await this.api.grantedScopes(memberId)).has(ANALYTICS_SCOPE))
      return result;

    for (const urn of externalIds.filter((id) => POST_URN.test(id))) {
      const counts: Partial<Record<LinkedInMetricType, number>> = {};
      for (const metric of METRICS) {
        counts[metric] = await this.total(memberId, urn, metric);
      }
      result.set(urn, {
        likes: counts.REACTION,
        replies: counts.COMMENT,
        reposts: counts.RESHARE,
        views: counts.IMPRESSION,
        raw: counts,
      });
    }
    return result;
  }

  disconnect({ memberId }: LinkedInCredentials): Promise<void> {
    return this.api.forget(memberId);
  }

  private async total(
    memberId: string,
    urn: string,
    metric: LinkedInMetricType,
  ): Promise<number> {
    const kind = urn.startsWith('urn:li:share:') ? 'share' : 'ugc';
    // Rest.li syntax: the URN is encoded, the parentheses and colon are not.
    const query = `q=entity&entity=(${kind}:${encodeURIComponent(urn)})&queryType=${metric}&aggregation=TOTAL`;
    const { body } = await this.api.call<LinkedInPostAnalytics>(
      memberId,
      `/rest/memberCreatorPostAnalytics?${query}`,
    );
    return body.elements.reduce((sum, e) => sum + e.count, 0);
  }
}
