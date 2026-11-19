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
  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  brief: string;

  @ApiProperty({ type: [String], format: 'uuid' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsUUID('all', { each: true })
  accountIds: string[];

  @ApiProperty({ example: '2026-11-23' })
  @Type(() => Date)
  @IsDate()
  startDate: Date;

  @ApiPropertyOptional({ minimum: 1, maximum: 31, default: 7 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  days = 7;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 21,
    default: 4,
    description: 'Roughly how many posts each account gets per week',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(21)
  postsPerWeekPerAccount = 4;

  @ApiPropertyOptional({ example: 'Africa/Kampala', default: 'UTC' })
  @IsOptional()
  @IsTimeZone()
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
