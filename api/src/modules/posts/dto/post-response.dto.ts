import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Platform } from '../../../common/enums/platform.enum.js';
import type { PostTarget } from '../entities/post-target.entity.js';
import type { Post } from '../entities/post.entity.js';
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

export class PostTargetResponseDto {
  @ApiProperty() id: string;
  @ApiProperty({ type: TargetAccountSummaryDto })
  account: TargetAccountSummaryDto;
  @ApiProperty({ description: 'Text that is or will be published' })
  text: string;
  @ApiProperty({ description: "True when text differs from the post's body" })
  customText: boolean;
  @ApiProperty({ enum: TargetStatus }) status: TargetStatus;
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
  @ApiProperty({ enum: PostSource }) source: PostSource;
  @ApiProperty({ enum: PostStatus }) status: PostStatus;
  @ApiProperty({ type: [PostTargetResponseDto] })
  targets: PostTargetResponseDto[];
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

  static from(post: Post): PostResponseDto {
    const targets = [...post.targets].sort((a, b) =>
      a.account.platform.localeCompare(b.account.platform),
    );
    return {
      id: post.id,
      title: post.title,
      body: post.body,
      source: post.source,
      status: derivePostStatus(targets.map((t) => t.status)),
      targets: targets.map((t) => PostTargetResponseDto.from(t, post)),
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
  }
}
