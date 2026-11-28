import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDate,
  IsInt,
  IsOptional,
  IsTimeZone,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Platform } from '../../../common/enums/platform.enum.js';

export class ScheduleSuggestionsDto {
  @ApiProperty({ type: [String], format: 'uuid' })
  @IsArray({ message: 'Choose at least one account' })
  @ArrayMinSize(1, { message: 'Choose at least one account' })
  @ArrayMaxSize(20, { message: 'Choose up to 20 accounts' })
  @IsUUID('all', { each: true, message: 'Choose accounts from the list' })
  accountIds: string[];

  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Start looking from here. Defaults to now.',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'Choose a date and time to start from' })
  from?: Date;

  @ApiPropertyOptional({ minimum: 1, maximum: 31, default: 7 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Look between 1 and 31 days ahead' })
  @Min(1, { message: 'Look between 1 and 31 days ahead' })
  @Max(31, { message: 'Look between 1 and 31 days ahead' })
  days = 7;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 10,
    default: 3,
    description: 'Times per account',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Ask for between 1 and 10 times per account' })
  @Min(1, { message: 'Ask for between 1 and 10 times per account' })
  @Max(10, { message: 'Ask for between 1 and 10 times per account' })
  count = 3;

  @ApiPropertyOptional({
    example: 'Africa/Kampala',
    description: "Defaults to the workspace's audience time zone",
  })
  @IsOptional()
  @IsTimeZone({ message: 'Choose a time zone from the list' })
  timeZone?: string;
}

export class ScheduleSuggestionDto {
  @ApiProperty({ format: 'uuid' }) accountId: string;
  @ApiProperty({ enum: Platform }) platform: Platform;
  @ApiProperty({ description: 'When to post, in UTC' }) at: Date;
  @ApiProperty({
    example:
      'Tuesday 09:02 (EAT) is one of X’s strongest times. Source: Buffer 2026, Hootsuite 2025 and Sprout Social 2026 studies of X posts.',
  })
  reason: string;
}

export class ScheduleSuggestionsResponseDto {
  @ApiProperty({ example: 'Africa/Kampala' }) timeZone: string;
  @ApiProperty({
    type: [ScheduleSuggestionDto],
    description:
      'Per account in the order asked, earliest first. Fewer than asked when the caps leave no more room.',
  })
  suggestions: ScheduleSuggestionDto[];
}
