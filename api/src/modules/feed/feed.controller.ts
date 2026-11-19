import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Paginated } from '../../common/dto/pagination-query.dto.js';
import { CalendarQueryDto, FeedItemDto, FeedQueryDto } from './dto/feed.dto.js';
import { FeedService } from './feed.service.js';

@ApiTags('feed')
@Controller()
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @Get('feed')
  @ApiOperation({
    summary: 'Every published post across all accounts, newest first',
  })
  feed(@Query() query: FeedQueryDto): Promise<Paginated<FeedItemDto>> {
    return this.feedService.feed(query);
  }

  @Get('calendar')
  @ApiOperation({
    summary: 'Drafts, scheduled and published posts in a date range',
  })
  @ApiOkResponse({ type: [FeedItemDto] })
  calendar(@Query() query: CalendarQueryDto): Promise<FeedItemDto[]> {
    return this.feedService.calendar(query);
  }
}
