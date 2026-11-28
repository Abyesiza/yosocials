import { BadRequestException, Injectable } from '@nestjs/common';
import { Platform } from '../../../../common/enums/platform.enum.js';
import { PlatformApiError } from '../../../../common/http/http-client.js';
import type {
  OAuthConnector,
  PlatformProvider,
  PostMetrics,
  ProviderCapabilities,
  PublishCheck,
  PublishInput,
  PublishResult,
  ReadinessInput,
  VerifiedAccount,
} from '../../interfaces/platform-provider.interface.js';
import { parseCredentialsDto } from '../../parse-credentials.js';
import { TikTokApi } from './tiktok-api.js';
import { TikTokOptionsDto } from './tiktok-options.dto.js';
import type {
  TikTokCreatorInfo,
  TikTokPublishStatus,
  TikTokUser,
  TikTokVideo,
} from './tiktok.types.js';

/** Stored per account. The OAuth tokens live in the session store under the open id. */
export interface TikTokCredentials {
  openId: string;
}

/** What the composer shows before posting, as TikTok's UX guidelines require. */
export interface TikTokCreatorInfoResult {
  nickname: string;
  username: string | null;
  avatarUrl: string | null;
  privacyLevelOptions: string[];
  commentDisabled: boolean;
  duetDisabled: boolean;
  stitchDisabled: boolean;
  maxVideoPostDurationSec: number | null;
  canDirectPost: boolean;
  canUploadToInbox: boolean;
}

const MAX_IMAGES = 35;
const VIDEO_QUERY_BATCH = 20;
const PUBLIC_VIDEO_ID = /^\d+$/;

const FAIL_REASONS: Record<string, string> = {
  file_format_check_failed:
    'TikTok couldn’t read the file format. Use MP4 (H.264), MOV or WebM.',
  duration_check_failed:
    'The video is longer than this TikTok account can post. Use a shorter video.',
  frame_rate_check_failed:
    'The video must be between 23 and 60 frames per second.',
  picture_size_check_failed:
    'The video or photo size isn’t supported (360 to 4096 pixels per side; photos up to 1080p).',
  internal: 'TikTok had a problem on its side. Try again.',
  video_pull_failed: 'TikTok couldn’t download the video. Try again.',
  photo_pull_failed: 'TikTok couldn’t download the photos. Try again.',
  publish_cancelled: 'The post was cancelled on TikTok.',
  auth_removed:
    'Aby Socials’ access to this TikTok account was removed. Reconnect the account to keep posting.',
  spam_risk_too_many_posts:
    'This TikTok account has reached its daily posting limit.',
  spam_risk_user_banned_from_posting:
    'TikTok isn’t letting this account post right now.',
  spam_risk_text: 'TikTok flagged the caption as possible spam.',
  spam_risk: 'TikTok flagged the post as possible spam.',
};

@Injectable()
export class TikTokProvider implements PlatformProvider<TikTokCredentials> {
  readonly platform = Platform.TikTok;
  readonly displayName = 'TikTok';
  readonly capabilities: ProviderCapabilities = {
    // Video captions; photo descriptions allow 4000 but share this limit.
    maxTextLength: 2200,
    lengthUnit: 'characters',
    supportsMetrics: true,
    contentStyle:
      'Caption for a short vertical video or photo carousel. Hook in the first line, a short call to action, then 3 to 5 relevant #hashtags. The video or photos carry the post; the caption supports them.',
    connect: 'oauth',
    media: { required: true, video: true, maxImages: MAX_IMAGES },
  };

  readonly oauth: OAuthConnector;

  constructor(private readonly api: TikTokApi) {
    this.oauth = {
      isConfigured: () => api.isConfigured(),
      authorizeUrl: (state) => api.authorizeUrl(state),
      exchange: async (code) => ({ openId: await api.exchangeCode(code) }),
    };
  }

  parseCredentials(): Promise<TikTokCredentials> {
    return Promise.reject(
      new BadRequestException(
        'TikTok connects with “Continue with TikTok”; there is nothing to paste.',
      ),
    );
  }

  async verify({ openId }: TikTokCredentials): Promise<VerifiedAccount> {
    const scopes = await this.api.grantedScopes(openId);
    const fields = ['open_id', 'avatar_url', 'display_name'];
    if (scopes.has('user.info.profile')) {
      fields.push('username', 'profile_deep_link');
    }
    const { user } = await this.api.call<{ user: TikTokUser }>(
      openId,
      '/v2/user/info/',
      { query: { fields: fields.join(',') } },
    );
    const name = user.display_name || user.username || 'TikTok account';
    return {
      externalId: user.open_id,
      handle: user.username ? `@${user.username}` : name,
      displayName: name,
      profileUrl:
        user.profile_deep_link ??
        (user.username
          ? `https://www.tiktok.com/@${user.username}`
          : undefined),
      avatarUrl: user.avatar_url,
    };
  }

  parseTargetOptions(raw: unknown): Promise<Record<string, unknown>> {
    return parseCredentialsDto(TikTokOptionsDto, raw, 'options').then((o) => ({
      ...o,
    }));
  }

  readinessIssues({ media, options }: ReadinessInput): string[] {
    const issues: string[] = [];
    const videos = media.filter((m) => m.kind === 'video');
    if (media.length === 0) {
      issues.push('add a video or photos. TikTok posts need media.');
    } else if (videos.length === 0 && media.length > MAX_IMAGES) {
      issues.push(`use up to ${MAX_IMAGES} photos.`);
    }
    const o = options as TikTokOptionsDto | null;
    if (!o?.mode) {
      issues.push(
        'choose whether to post directly or send to the TikTok inbox.',
      );
      return issues;
    }
    if (o.mode === 'direct' && !o.privacyLevel) {
      issues.push('choose who can see this post.');
    }
    if (o.brandedContent && o.privacyLevel === 'SELF_ONLY') {
      issues.push(
        'choose an audience other than “Only me”. Branded content can’t be private.',
      );
    }
    return issues;
  }

  async creatorInfo({
    openId,
  }: TikTokCredentials): Promise<TikTokCreatorInfoResult> {
    const scopes = await this.api.grantedScopes(openId);
    const canDirectPost = scopes.has('video.publish');
    const canUploadToInbox = scopes.has('video.upload');
    if (!canDirectPost) {
      const account = await this.verify({ openId });
      return {
        nickname: account.displayName,
        username: account.handle.startsWith('@')
          ? account.handle.slice(1)
          : null,
        avatarUrl: account.avatarUrl ?? null,
        privacyLevelOptions: [],
        commentDisabled: false,
        duetDisabled: false,
        stitchDisabled: false,
        maxVideoPostDurationSec: null,
        canDirectPost,
        canUploadToInbox,
      };
    }
    const info = await this.queryCreator(openId);
    return {
      nickname: info.creator_nickname,
      username: info.creator_username || null,
      avatarUrl: info.creator_avatar_url || null,
      privacyLevelOptions: info.privacy_level_options,
      commentDisabled: info.comment_disabled,
      duetDisabled: info.duet_disabled,
      stitchDisabled: info.stitch_disabled,
      maxVideoPostDurationSec: info.max_video_post_duration_sec,
      canDirectPost,
      canUploadToInbox,
    };
  }

  async publish(
    { openId }: TikTokCredentials,
    input: PublishInput,
  ): Promise<PublishResult> {
    const issues = this.readinessIssues(input);
    if (issues.length > 0)
      throw new BadRequestException(`To post to TikTok, ${issues[0]}`);
    const o = input.options as unknown as TikTokOptionsDto;
    const video = input.media.find((m) => m.kind === 'video');
    const direct = o.mode === 'direct';

    // TikTok requires fresh creator info before every direct post.
    const creator = direct ? await this.queryCreator(openId) : null;
    if (creator) {
      if (!creator.privacy_level_options.includes(o.privacyLevel!)) {
        throw new BadRequestException(
          'That privacy setting is no longer available for this TikTok account. Pick another one.',
        );
      }
      const max = creator.max_video_post_duration_sec;
      if (video?.durationSec && max && video.durationSec > max) {
        throw new BadRequestException(
          `This TikTok account can post videos up to ${max} seconds; this one is ${Math.round(video.durationSec)}. Use a shorter video.`,
        );
      }
    }

    const interactions = creator && {
      disable_comment: creator.comment_disabled || !o.allowComment,
      brand_content_toggle: Boolean(o.brandedContent),
      brand_organic_toggle: Boolean(o.brandOrganic),
    };

    let path: string;
    let body: unknown;
    if (video) {
      const source_info = { source: 'PULL_FROM_URL', video_url: video.url };
      path = direct
        ? '/v2/post/publish/video/init/'
        : '/v2/post/publish/inbox/video/init/';
      body = direct
        ? {
            post_info: {
              title: input.text,
              privacy_level: o.privacyLevel,
              ...interactions,
              disable_duet: creator!.duet_disabled || !o.allowDuet,
              disable_stitch: creator!.stitch_disabled || !o.allowStitch,
              is_aigc: Boolean(o.isAigc),
            },
            source_info,
          }
        : { source_info };
    } else {
      path = '/v2/post/publish/content/init/';
      body = {
        post_info: {
          title: o.photoTitle ?? '',
          description: input.text,
          ...(direct && {
            privacy_level: o.privacyLevel,
            ...interactions,
            auto_add_music: Boolean(o.autoAddMusic),
          }),
        },
        source_info: {
          source: 'PULL_FROM_URL',
          photo_cover_index: 0,
          photo_images: input.media.map((m) => m.url),
        },
        post_mode: direct ? 'DIRECT_POST' : 'MEDIA_UPLOAD',
        media_type: 'PHOTO',
      };
    }

    try {
      const { publish_id } = await this.api.call<{ publish_id: string }>(
        openId,
        path,
        { json: body },
      );
      return {
        externalId: publish_id,
        publishedAt: new Date(),
        processing: true,
      };
    } catch (error) {
      // TikTok has no idempotency keys: a request that timed out may have landed.
      if (error instanceof PlatformApiError && error.status === 0) {
        throw new PlatformApiError(
          'We lost contact with TikTok while sending this. It may have been posted, so check the profile before you try again.',
          0,
          false,
        );
      }
      throw error;
    }
  }

  async checkPublish(
    { openId }: TikTokCredentials,
    publishId: string,
  ): Promise<PublishCheck> {
    const status = await this.api.call<TikTokPublishStatus>(
      openId,
      '/v2/post/publish/status/fetch/',
      // Video ids are 19-digit numbers in this response.
      { json: { publish_id: publishId }, bigIntsAsStrings: true },
    );
    switch (status.status) {
      case 'SEND_TO_USER_INBOX':
        return { state: 'in_inbox' };
      case 'FAILED':
        return {
          state: 'failed',
          reason:
            FAIL_REASONS[status.fail_reason ?? ''] ??
            'TikTok couldn’t publish this post. Check the video or photos and try again.',
        };
      case 'PUBLISH_COMPLETE': {
        // Empty for private posts: there is no public video to link to.
        const id = status.publicaly_available_post_id?.[0];
        if (id === undefined) return { state: 'published' };
        const [video] = await this.queryVideos(
          openId,
          [String(id)],
          ['id', 'share_url'],
        );
        return {
          state: 'published',
          externalId: String(id),
          externalUrl: video?.share_url,
        };
      }
      default:
        return { state: 'processing' };
    }
  }

  async fetchMetrics(
    { openId }: TikTokCredentials,
    externalIds: string[],
  ): Promise<Map<string, PostMetrics>> {
    const result = new Map<string, PostMetrics>();
    const ids = externalIds.filter((id) => PUBLIC_VIDEO_ID.test(id));
    if (
      ids.length === 0 ||
      !(await this.api.grantedScopes(openId)).has('video.list')
    ) {
      return result;
    }
    for (let i = 0; i < ids.length; i += VIDEO_QUERY_BATCH) {
      const videos = await this.queryVideos(
        openId,
        ids.slice(i, i + VIDEO_QUERY_BATCH),
        ['id', 'like_count', 'comment_count', 'share_count', 'view_count'],
      );
      for (const v of videos) {
        result.set(String(v.id), {
          likes: v.like_count,
          replies: v.comment_count,
          reposts: v.share_count,
          views: v.view_count,
          raw: { ...v },
        });
      }
    }
    return result;
  }

  disconnect({ openId }: TikTokCredentials): Promise<void> {
    return this.api.revoke(openId);
  }

  private queryCreator(openId: string): Promise<TikTokCreatorInfo> {
    return this.api.call<TikTokCreatorInfo>(
      openId,
      '/v2/post/publish/creator_info/query/',
      { json: {} },
    );
  }

  private async queryVideos(
    openId: string,
    ids: string[],
    fields: string[],
  ): Promise<TikTokVideo[]> {
    if (!(await this.api.grantedScopes(openId)).has('video.list')) return [];
    const data = await this.api.call<{ videos?: TikTokVideo[] }>(
      openId,
      '/v2/video/query/',
      {
        query: { fields: fields.join(',') },
        json: { filters: { video_ids: ids } },
      },
    );
    return data.videos ?? [];
  }
}
