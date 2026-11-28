import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDate,
  IsInt,
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

  @ApiPropertyOptional({ example: 'Africa/Kampala', default: 'UTC' })
  @IsOptional()
  @IsTimeZone({ message: 'Choose a time zone from the list' })
  timezone = 'UTC';
}

export class PlanCalendarResponseDto {
  @ApiProperty() model: string;

  @ApiProperty({
    type: [PostResponseDto],
    description:
      'Draft posts. Review, then POST /posts/:id/schedule to approve.',
  })
  posts: PostResponseDto[];

  @ApiProperty({
    type: [String],
    description: 'Suggestions dropped because they broke a platform rule',
  })
  skipped: string[];
}
