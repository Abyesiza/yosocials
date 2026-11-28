import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Platform } from '../../../common/enums/platform.enum.js';
import type { LengthUnit } from '../../../common/text/text-length.js';

export class MediaCapabilitiesDto {
  @ApiProperty() required: boolean;
  @ApiProperty() video: boolean;
  @ApiProperty() maxImages: number;
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
