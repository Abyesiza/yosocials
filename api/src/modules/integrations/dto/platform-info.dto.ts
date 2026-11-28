import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Platform } from '../../../common/enums/platform.enum.js';
import type { LengthUnit } from '../../../common/text/text-length.js';
import type {
  ImageSpec,
  VideoSpec,
} from '../interfaces/platform-provider.interface.js';

export class MediaCapabilitiesDto {
  @ApiProperty() required: boolean;
  @ApiProperty() video: boolean;
  @ApiProperty() maxImages: number;

  @ApiPropertyOptional({
    type: 'object',
    nullable: true,
    additionalProperties: true,
    description:
      'What a photo must be: types, maxBytes, maxLongSide, maxShortSide, maxPixels, maxSideSum, aspect {min, max, preferred}',
  })
  imageSpec: ImageSpec | null;

  @ApiPropertyOptional({
    type: 'object',
    nullable: true,
    additionalProperties: true,
    description:
      'What a video must be: types, codecs, maxBytes, min/maxDurationSec, minShortSide, maxLongSide, maxShortSide, maxPixels, min/maxFps, aspect',
  })
  videoSpec: VideoSpec | null;
}

export class PlatformInfoDto {
  @ApiProperty({ enum: Platform })
  platform: Platform;

  @ApiProperty()
  displayName: string;

  @ApiProperty()
  maxTextLength: number;

  @ApiProperty({
    enum: ['graphemes', 'characters', 'weighted'],
    description: 'weighted: X’s count (links 23, CJK and emoji 2)',
  })
  lengthUnit: LengthUnit;

  @ApiProperty()
  supportsMetrics: boolean;

  @ApiProperty({ enum: ['credentials', 'oauth'] })
  connect: 'credentials' | 'oauth';

  @ApiProperty({
    description:
      'False while an OAuth platform has no app credentials configured',
  })
  available: boolean;

  @ApiPropertyOptional({
    type: MediaCapabilitiesDto,
    nullable: true,
    description: 'null: text only',
  })
  media: MediaCapabilitiesDto | null;
}
