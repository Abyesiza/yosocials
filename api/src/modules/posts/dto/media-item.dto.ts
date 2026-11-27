import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
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

/** A file uploaded through `POST /media/uploads`, attached to a post. */
export class MediaItemDto {
  @ApiProperty({
    example: '<workspaceId>_<uuid>.mp4',
    description: 'UploadThing custom id',
  })
  @IsString()
  @Matches(MEDIA_PATH_PATTERN, { message: 'media path is not an upload path' })
  path: string;

  @ApiProperty({ enum: MEDIA_CONTENT_TYPES })
  @IsIn(MEDIA_CONTENT_TYPES)
  contentType: string;

  @ApiProperty({ description: 'Bytes' })
  @IsInt()
  @Min(1)
  size: number;

  @ApiPropertyOptional({ description: 'Video length in seconds' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(24 * 60 * 60)
  durationSec?: number;
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
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(35)
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
