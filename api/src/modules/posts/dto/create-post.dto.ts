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
  @IsString({ message: 'Write something for this account’s version' })
  @MinLength(1, { message: 'Write something for this account’s version' })
  @MaxLength(10_000, { message: 'Posts can be up to 10,000 characters' })
  text?: string;

  @ApiPropertyOptional({ description: "Overrides the post's scheduledAt" })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'Choose a date and time' })
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
  @IsString({ message: 'Use 200 characters or fewer for the title' })
  @MaxLength(200, { message: 'Use 200 characters or fewer for the title' })
  title?: string;

  @ApiProperty({ maxLength: 10_000 })
  @IsString({ message: 'Write something for the post' })
  @MinLength(1, { message: 'Write something for the post' })
  @MaxLength(10_000, { message: 'Posts can be up to 10,000 characters' })
  body: string;

  @ApiPropertyOptional({
    type: [MediaItemDto],
    description: 'One video, or up to 35 images',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(35, { message: 'Attach up to 35 photos' })
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
  @IsDate({ message: 'Choose a date and time' })
  scheduledAt?: Date;

  @ApiProperty({ type: [CreatePostTargetDto] })
  @IsArray({ message: 'Choose at least one account to post to' })
  @ArrayMinSize(1, { message: 'Choose at least one account to post to' })
  @ArrayMaxSize(50, { message: 'Choose up to 50 accounts' })
  @ValidateNested({ each: true })
  @Type(() => CreatePostTargetDto)
  targets: CreatePostTargetDto[];
}
