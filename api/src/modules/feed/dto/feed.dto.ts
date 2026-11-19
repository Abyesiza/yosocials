import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
import { Platform } from '../../../common/enums/platform.enum.js';
import { PostTargetResponseDto } from '../../posts/dto/post-response.dto.js';

export class FeedQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: Platform })
  @IsOptional()
  @IsEnum(Platform)
  platform?: Platform;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  accountId?: string;
}

export class CalendarQueryDto {
  @ApiProperty({ example: '2026-11-23T00:00:00Z' })
  @Type(() => Date)
  @IsDate()
  from: Date;

  @ApiProperty({ example: '2026-11-30T00:00:00Z' })
  @Type(() => Date)
  @IsDate()
  to: Date;

  @ApiPropertyOptional({ enum: Platform })
  @IsOptional()
  @IsEnum(Platform)
  platform?: Platform;
}

/** One post on one account, with its parent post's id and label. */
export class FeedItemDto extends PostTargetResponseDto {
  @ApiProperty() postId: string;
  @ApiPropertyOptional({ nullable: true }) postTitle: string | null;
}
