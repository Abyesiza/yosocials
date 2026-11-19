import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Platform } from '../../../common/enums/platform.enum.js';

export class OverviewQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 365, default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days = 30;
}

export class EngagementTotalsDto {
  @ApiProperty() posts: number;
  @ApiProperty() likes: number;
  @ApiProperty() reposts: number;
  @ApiProperty() replies: number;
  @ApiProperty() quotes: number;
  @ApiProperty() views: number;
  @ApiProperty({ description: 'likes + reposts + replies + quotes' })
  engagement: number;
}

export class AccountOverviewDto extends EngagementTotalsDto {
  @ApiProperty() accountId: string;
  @ApiProperty({ enum: Platform }) platform: Platform;
  @ApiProperty() handle: string;
  @ApiProperty() displayName: string;
}

export class TopPostDto {
  @ApiProperty() targetId: string;
  @ApiProperty() postId: string;
  @ApiProperty({ enum: Platform }) platform: Platform;
  @ApiProperty() handle: string;
  @ApiProperty() text: string;
  @ApiPropertyOptional({ nullable: true }) externalUrl: string | null;
  @ApiProperty() publishedAt: Date;
  @ApiProperty() engagement: number;
}

export class OverviewResponseDto {
  @ApiProperty() days: number;
  @ApiProperty({ type: EngagementTotalsDto }) totals: EngagementTotalsDto;
  @ApiProperty({ type: [AccountOverviewDto] }) accounts: AccountOverviewDto[];
  @ApiProperty({ type: [TopPostDto] }) topPosts: TopPostDto[];
}

export class MetricPointDto {
  @ApiProperty() capturedAt: Date;
  @ApiPropertyOptional({ nullable: true }) likes: number | null;
  @ApiPropertyOptional({ nullable: true }) reposts: number | null;
  @ApiPropertyOptional({ nullable: true }) replies: number | null;
  @ApiPropertyOptional({ nullable: true }) quotes: number | null;
  @ApiPropertyOptional({ nullable: true }) views: number | null;
}

export class RefreshResponseDto {
  @ApiProperty({ description: 'Targets whose metrics were captured' })
  captured: number;
}
