import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  CurrentWorkspace,
  RequireRole,
  WorkspaceScoped,
} from '../workspaces/decorators/workspace.decorators.js';
import { WorkspaceRole } from '../workspaces/enums/workspace-role.enum.js';
import type { WorkspaceContext } from '../workspaces/interfaces/workspace-context.interface.js';
import { AnalyticsService } from './analytics.service.js';
import {
  MetricPointDto,
  OverviewQueryDto,
  OverviewResponseDto,
  RefreshResponseDto,
} from './dto/analytics.dto.js';

@ApiTags('analytics')
@WorkspaceScoped()
@Controller('workspaces/:workspaceId/analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('overview')
  @ApiOkResponse({ type: OverviewResponseDto })
  overview(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Query() query: OverviewQueryDto,
  ): Promise<OverviewResponseDto> {
    return this.analytics.overview(ws.workspaceId, query.days);
  }

  @Get('targets/:targetId/history')
  @ApiOkResponse({ type: [MetricPointDto] })
  history(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('targetId', ParseUUIDPipe) targetId: string,
  ): Promise<MetricPointDto[]> {
    return this.analytics.history(ws.workspaceId, targetId);
  }

  @Post('refresh')
  @RequireRole(WorkspaceRole.Editor)
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: RefreshResponseDto })
  async refresh(
    @CurrentWorkspace() ws: WorkspaceContext,
  ): Promise<RefreshResponseDto> {
    return { captured: await this.analytics.collectDue(ws.workspaceId) };
  }
}
