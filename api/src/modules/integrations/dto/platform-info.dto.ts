import { ApiProperty } from '@nestjs/swagger';
import { Platform } from '../../../common/enums/platform.enum.js';

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
}
