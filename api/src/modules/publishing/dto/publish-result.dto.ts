import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TargetStatus } from '../../posts/enums/post-status.enum.js';

export class PublishOutcomeDto {
  @ApiProperty() targetId: string;
  @ApiProperty({ enum: TargetStatus }) status: TargetStatus;
  @ApiPropertyOptional() error?: string;
}
