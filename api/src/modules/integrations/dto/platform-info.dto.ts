import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Platform } from '../../../common/enums/platform.enum.js';

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

  @ApiProperty({ enum: ['graphemes', 'characters'] })
  lengthUnit: 'graphemes' | 'characters';

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
