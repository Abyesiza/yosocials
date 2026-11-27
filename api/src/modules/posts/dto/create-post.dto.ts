import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDate,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { MediaItemDto } from './media-item.dto.js';

export class CreatePostTargetDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  accountId: string;

  @ApiPropertyOptional({
    description: "Overrides the post's body on this account",
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(10_000)
  text?: string;

  @ApiPropertyOptional({ description: "Overrides the post's scheduledAt" })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  scheduledAt?: Date;

  @ApiPropertyOptional({
    description:
      'Platform settings, e.g. TikTok privacy; validated per platform',
  })
  @IsOptional()
  @IsObject()
  options?: Record<string, unknown>;
}

export class CreatePostDto {
  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiProperty({ maxLength: 10_000 })
  @IsString()
  @MinLength(1)
  @MaxLength(10_000)
  body: string;

  @ApiPropertyOptional({
    type: [MediaItemDto],
    description: 'One video, or up to 35 images',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(35)
  @ValidateNested({ each: true })
  @Type(() => MediaItemDto)
  media?: MediaItemDto[];

  /**
   * When set (here or per target), targets are created as `scheduled`.
   * Otherwise they are `draft` until scheduled or published.
   */
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  scheduledAt?: Date;

  @ApiProperty({ type: [CreatePostTargetDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreatePostTargetDto)
  targets: CreatePostTargetDto[];
}
