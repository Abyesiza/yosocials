import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Platform } from '../../../common/enums/platform.enum.js';
import type { PostTarget } from '../entities/post-target.entity.js';
import {
  mediaFor,
  type MediaFile,
  type Post,
  type PostMedia,
} from '../entities/post.entity.js';
import {
  derivePostStatus,
  PostSource,
  PostStatus,
  TargetStatus,
} from '../enums/post-status.enum.js';

export class TargetAccountSummaryDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: Platform }) platform: Platform;
  @ApiProperty() handle: string;
  @ApiProperty() displayName: string;
  @ApiPropertyOptional({ nullable: true }) avatarUrl: string | null;
}

export class TargetMetricsDto {
  @ApiPropertyOptional({ nullable: true }) likes: number | null;
  @ApiPropertyOptional({ nullable: true }) reposts: number | null;
  @ApiPropertyOptional({ nullable: true }) replies: number | null;
  @ApiPropertyOptional({ nullable: true }) quotes: number | null;
  @ApiPropertyOptional({ nullable: true }) views: number | null;
  @ApiPropertyOptional({ nullable: true }) updatedAt: Date | null;
}

export class MediaFileResponseDto {
  @ApiProperty() path: string;
  @ApiProperty() contentType: string;
  @ApiProperty() size: number;
  @ApiPropertyOptional({ nullable: true }) width: number | null;
  @ApiPropertyOptional({ nullable: true }) height: number | null;
  @ApiProperty({ description: 'Public URL' }) url: string;

  static fromFile(
    file: MediaFile,
    url: string,
  ): Pick<MediaFileResponseDto, keyof MediaFileResponseDto> {
    return {
      path: file.path,
      contentType: file.contentType,
      size: file.size,
      width: file.width ?? null,
      height: file.height ?? null,
      url,
    };
  }
}

export class MediaVariantResponseDto extends MediaFileResponseDto {
  @ApiProperty({ enum: Platform }) platform: Platform;
}

export class PostMediaResponseDto extends MediaFileResponseDto {
  @ApiProperty({ enum: ['image', 'video'] }) kind: 'image' | 'video';
  @ApiPropertyOptional({ nullable: true }) durationSec: number | null;
  @ApiProperty({
    type: [MediaVariantResponseDto],
    description: 'Copies prepared for platforms that can’t take the original',
  })
  variants: MediaVariantResponseDto[];

  /**
   * With `platform`, the top-level file is what that platform gets (its own
   * copy, or the original), as shown in a feed of that account's posts.
   */
  static from(
    media: PostMedia,
    mediaUrl: (path: string) => string,
    platform?: Platform,
  ): PostMediaResponseDto {
    const file = platform ? mediaFor(media, platform) : media;
    return {
      ...MediaFileResponseDto.fromFile(file, mediaUrl(file.path)),
      kind: media.kind,
      durationSec: media.durationSec ?? null,
      variants: (media.variants ?? []).map((v) => ({
        ...MediaFileResponseDto.fromFile(v, mediaUrl(v.path)),
        platform: v.platform,
      })),
    };
  }
}

export class PostTargetResponseDto {
  @ApiProperty() id: string;
  @ApiProperty({ type: TargetAccountSummaryDto })
  account: TargetAccountSummaryDto;
  @ApiProperty({ description: 'Text that is or will be published' })
  text: string;
  @ApiProperty({ description: "True when text differs from the post's body" })
  customText: boolean;
  @ApiProperty({ enum: TargetStatus }) status: TargetStatus;
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    description: 'Platform settings, e.g. TikTok privacy',
  })
  options: Record<string, unknown> | null;
  @ApiPropertyOptional({ nullable: true }) scheduledAt: Date | null;
  @ApiPropertyOptional({ nullable: true }) publishedAt: Date | null;
  @ApiPropertyOptional({ nullable: true }) externalUrl: string | null;
  @ApiPropertyOptional({ nullable: true }) lastError: string | null;
  @ApiProperty({ type: TargetMetricsDto }) metrics: TargetMetricsDto;

  static from(target: PostTarget, post: Post): PostTargetResponseDto {
    const { account } = target;
    return {
      id: target.id,
      account: {
        id: account.id,
        platform: account.platform,
        handle: account.handle,
        displayName: account.displayName,
        avatarUrl: account.avatarUrl,
      },
      text: target.effectiveText(post),
      customText: target.text !== null,
      status: target.status,
      options: target.options,
      scheduledAt: target.scheduledAt,
      publishedAt: target.publishedAt,
      externalUrl: target.externalUrl,
      lastError: target.lastError,
      metrics: {
        likes: target.likes,
        reposts: target.reposts,
        replies: target.replies,
        quotes: target.quotes,
        views: target.views,
        updatedAt: target.metricsUpdatedAt,
      },
    };
  }
}

export class PostResponseDto {
  @ApiProperty() id: string;
  @ApiPropertyOptional({ nullable: true }) title: string | null;
  @ApiProperty() body: string;
  @ApiProperty({ type: [PostMediaResponseDto] }) media: PostMediaResponseDto[];
  @ApiProperty({ enum: PostSource }) source: PostSource;
  @ApiProperty({ enum: PostStatus }) status: PostStatus;
  @ApiProperty({ type: [PostTargetResponseDto] })
  targets: PostTargetResponseDto[];
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

  /** `mediaUrl` turns a stored path into its public URL. */
  static from(post: Post, mediaUrl: (path: string) => string): PostResponseDto {
    const targets = [...post.targets].sort((a, b) =>
      a.account.platform.localeCompare(b.account.platform),
    );
    return {
      id: post.id,
      title: post.title,
      body: post.body,
      media: post.media.map((m) => PostMediaResponseDto.from(m, mediaUrl)),
      source: post.source,
      status: derivePostStatus(targets.map((t) => t.status)),
      targets: targets.map((t) => PostTargetResponseDto.from(t, post)),
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
  }
}
