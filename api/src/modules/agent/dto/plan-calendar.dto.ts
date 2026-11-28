import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsInt,
  IsISO31661Alpha2,
  IsOptional,
  IsString,
  IsTimeZone,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PostResponseDto } from '../../posts/dto/post-response.dto.js';
import { TrendSnapshotDto } from '../../trends/dto/trends.dto.js';
import type { GroundingInfo } from '../interfaces/language-model.interface.js';

export class PlanCalendarDto {
  @ApiProperty({
    example:
      'Launch week for our new budgeting app. Audience: young professionals. Goal: waitlist sign-ups.',
  })
  @IsString({ message: 'Describe your plan in at least 10 characters' })
  @MinLength(10, { message: 'Describe your plan in at least 10 characters' })
  @MaxLength(4000, { message: 'Keep your plan to 4,000 characters or fewer' })
  brief: string;

  @ApiProperty({ type: [String], format: 'uuid' })
  @IsArray({ message: 'Choose at least one account' })
  @ArrayMinSize(1, { message: 'Choose at least one account' })
  @ArrayMaxSize(20, { message: 'Choose up to 20 accounts' })
  @IsUUID('all', { each: true })
  accountIds: string[];

  @ApiProperty({ example: '2026-11-23' })
  @Type(() => Date)
  @IsDate({ message: 'Choose a start date' })
  startDate: Date;

  @ApiPropertyOptional({ minimum: 1, maximum: 31, default: 7 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Plan between 1 and 31 days' })
  @Min(1, { message: 'Plan between 1 and 31 days' })
  @Max(31, { message: 'Plan between 1 and 31 days' })
  days = 7;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 21,
    default: 4,
    description: 'Roughly how many posts each account gets per week',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Choose between 1 and 21 posts a week' })
  @Min(1, { message: 'Choose between 1 and 21 posts a week' })
  @Max(21, { message: 'Choose between 1 and 21 posts a week' })
  postsPerWeekPerAccount = 4;

  @ApiPropertyOptional({
    example: 'Africa/Kampala',
    description: "Defaults to the workspace's audience time zone",
  })
  @IsOptional()
  @IsTimeZone({ message: 'Choose a time zone from the list' })
  timezone?: string;

  @ApiPropertyOptional({
    example: 'UG',
    description:
      "Where the audience lives (ISO 3166-1 alpha-2). Defaults to the workspace's audience country",
  })
  @IsOptional()
  @IsISO31661Alpha2({ message: 'Choose a country from the list' })
  country?: string;

  @ApiPropertyOptional({
    default: true,
    description:
      'Give the AI what’s trending for the audience country (Google Trends, Mastodon, Bluesky)',
  })
  @IsOptional()
  @IsBoolean()
  useTrends = true;

  @ApiPropertyOptional({
    default: false,
    description:
      'Let the AI search the web first (only when GEMINI_SEARCH_GROUNDING is on; a paid Gemini key)',
  })
  @IsOptional()
  @IsBoolean()
  searchWeb = false;
}

export class PlanCalendarResponseDto {
  @ApiProperty() model: string;

  @ApiProperty({
    example: 'Africa/Kampala',
    description: 'The audience time zone the times were picked in',
  })
  timeZone: string;

  @ApiProperty({
    type: [PostResponseDto],
    description:
      'Draft posts. Review, then POST /posts/:id/schedule to approve.',
  })
  posts: PostResponseDto[];

  @ApiProperty({
    type: [String],
    description:
      'Suggestions dropped because they broke a platform rule or no time was free',
  })
  skipped: string[];

  @ApiPropertyOptional({
    type: TrendSnapshotDto,
    nullable: true,
    description: 'The trends the AI was given; null when none were used',
  })
  trends: TrendSnapshotDto | null;

  @ApiPropertyOptional({
    type: 'object',
    nullable: true,
    additionalProperties: true,
    description:
      'Present when the AI searched the web. Google’s terms: show searchEntryPointHtml and the sources unmodified, to this person only, and don’t store or share them.',
  })
  grounding: GroundingInfo | null;
}
