import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import {
  MEDIA_CONTENT_TYPES,
  MEDIA_PATH_PATTERN,
} from '../../../common/storage/media-types.js';

/** A file uploaded through `POST /media/uploads`, attached to a post. */
export class MediaItemDto {
  @ApiProperty({ example: '<workspaceId>/<uuid>.mp4' })
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

export class CreateUploadDto {
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

export class UploadTicketDto {
  @ApiProperty() path: string;
  @ApiProperty({ description: 'PUT the file here, with its Content-Type' })
  uploadUrl: string;
  @ApiProperty() publicUrl: string;
}
