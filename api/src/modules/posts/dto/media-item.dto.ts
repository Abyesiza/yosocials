import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  MEDIA_CONTENT_TYPES,
  MEDIA_PATH_PATTERN,
} from '../../../common/storage/media-types.js';
import { Platform } from '../../../common/enums/platform.enum.js';

const MAX_SIDE = 16_384;

/** Fields shared by an uploaded original and its prepared copies. */
class MediaFileDto {
  @ApiProperty({
    example: '<workspaceId>_<uuid>.mp4',
    description: 'UploadThing custom id',
  })
  @IsString()
  @Matches(MEDIA_PATH_PATTERN, {
    message: 'Upload the file through Aby Socials, then attach it',
  })
  path: string;

  @ApiProperty({ enum: MEDIA_CONTENT_TYPES })
  @IsIn(MEDIA_CONTENT_TYPES, {
    message: 'Upload an MP4, MOV or WebM video, or a JPEG or WebP image',
  })
  contentType: string;

  @ApiProperty({ description: 'Bytes' })
  @IsInt()
  @Min(1)
  size: number;

  @ApiPropertyOptional({ description: 'Pixels, as measured in the browser' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_SIDE)
  width?: number;

  @ApiPropertyOptional({ description: 'Pixels, as measured in the browser' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_SIDE)
  height?: number;
}

/** A copy of the file prepared to fit one platform. */
export class MediaVariantDto extends MediaFileDto {
  @ApiProperty({ enum: Platform })
  @IsEnum(Platform, { message: 'Prepared copies must name a platform' })
  platform: Platform;
}

/** A file uploaded through `POST /media/uploads`, attached to a post. */
export class MediaItemDto extends MediaFileDto {
  @ApiPropertyOptional({ description: 'Video length in seconds' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(24 * 60 * 60)
  durationSec?: number;

  @ApiPropertyOptional({
    type: [MediaVariantDto],
    description: 'Copies sized for platforms that can’t take the original',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(Object.values(Platform).length)
  @ValidateNested({ each: true })
  @Type(() => MediaVariantDto)
  variants?: MediaVariantDto[];
}

export class UploadFileDto {
  @ApiProperty({ enum: MEDIA_CONTENT_TYPES })
  @IsIn(MEDIA_CONTENT_TYPES, {
    message: 'Upload an MP4, MOV or WebM video, or a JPEG or WebP image',
  })
  contentType: string;

  @ApiProperty({ description: 'Bytes' })
  @IsInt()
  @Min(1)
  size: number;
}

export class ReserveUploadsDto {
  @ApiProperty({ type: [UploadFileDto] })
  @IsArray({ message: 'Choose at least one file to upload' })
  @ArrayMinSize(1, { message: 'Choose at least one file to upload' })
  @ArrayMaxSize(35, { message: 'Upload up to 35 files at a time' })
  @ValidateNested({ each: true })
  @Type(() => UploadFileDto)
  files: UploadFileDto[];
}

export class ReservedUploadsDto {
  @ApiProperty({
    type: [String],
    description: 'UploadThing custom id for each file, in order',
  })
  customIds: string[];
}
