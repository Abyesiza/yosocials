import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentWorkspace,
  WorkspaceScoped,
} from '../workspaces/decorators/workspace.decorators.js';
import type { WorkspaceContext } from '../workspaces/interfaces/workspace-context.interface.js';
import { WorkspacesService } from '../workspaces/workspaces.service.js';
import { TrendSnapshotDto, TrendsQueryDto } from './dto/trends.dto.js';
import { TrendsService } from './trends.service.js';

@ApiTags('trends')
@WorkspaceScoped()
@Controller('workspaces/:workspaceId')
export class TrendsController {
  constructor(
    private readonly trendsService: TrendsService,
    private readonly workspaces: WorkspacesService,
  ) {}

  @Get('trends')
  @ApiOperation({
    summary: 'What’s trending for an audience country',
    description:
      'Combines Google Trends’ daily “Trending now” list for the country with platform-wide trending tags from mastodon.social and trending topics from Bluesky (neither is country-specific). ' +
      'The Google Trends feed is unofficial and undocumented, and some countries (e.g. RW) have none; any source that is unavailable is left out and explained in `notes`. ' +
      'Shared by every workspace and cached for up to 3 hours. X trends aren’t included (they’re paid), and TikTok offers no API for trending sounds.',
  })
  @ApiOkResponse({ type: TrendSnapshotDto })
  async trends(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Query() query: TrendsQueryDto,
  ): Promise<TrendSnapshotDto> {
    const country =
      query.country ??
      (await this.workspaces.get(ws.workspaceId)).audienceCountry;
    if (!country) {
      throw new BadRequestException(
        'Choose your audience’s country in workspace settings to see what’s trending there.',
      );
    }
    return this.trendsService.forCountry(country);
  }
}
