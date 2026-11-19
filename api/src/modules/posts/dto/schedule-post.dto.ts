import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsUUID } from 'class-validator';

/** Approves draft targets so the scheduler publishes them on time. */
export class SchedulePostDto {
  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description: 'Targets to schedule. Defaults to every draft target.',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  targetIds?: string[];
}
