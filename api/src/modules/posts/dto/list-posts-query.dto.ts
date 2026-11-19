import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
import { PostSource, TargetStatus } from '../enums/post-status.enum.js';

export class ListPostsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: TargetStatus,
    description: 'Posts with at least one target in this status',
  })
  @IsOptional()
  @IsEnum(TargetStatus)
  status?: TargetStatus;

  @ApiPropertyOptional({ enum: PostSource })
  @IsOptional()
  @IsEnum(PostSource)
  source?: PostSource;
}
