import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Paginated } from '../../common/dto/pagination-query.dto.js';
import { CalendarQueryDto, FeedItemDto, FeedQueryDto } from './dto/feed.dto.js';
import { FeedService } from './feed.service.js';
import {
  CurrentWorkspace,
  WorkspaceScoped,
} from '../workspaces/decorators/workspace.decorators.js';
import type { WorkspaceContext } from '../workspaces/interfaces/workspace-context.interface.js';

@ApiTags('feed')
@WorkspaceScoped()
@Controller('workspaces/:workspaceId')
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @Get('feed')
  @ApiOperation({
    summary: 'Every published post across all accounts, newest first',
  })
  feed(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Query() query: FeedQueryDto,
  ): Promise<Paginated<FeedItemDto>> {
    return this.feedService.feed(ws.workspaceId, query);
  }

  @Get('calendar')
  @ApiOperation({
    summary: 'Drafts, scheduled and published posts in a date range',
  })
  @ApiOkResponse({ type: [FeedItemDto] })
  calendar(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Query() query: CalendarQueryDto,
  ): Promise<FeedItemDto[]> {
    return this.feedService.calendar(ws.workspaceId, query);
  }
}
