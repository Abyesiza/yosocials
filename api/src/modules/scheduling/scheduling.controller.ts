import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentWorkspace,
  RequireRole,
  WorkspaceScoped,
} from '../workspaces/decorators/workspace.decorators.js';
import { WorkspaceRole } from '../workspaces/enums/workspace-role.enum.js';
import type { WorkspaceContext } from '../workspaces/interfaces/workspace-context.interface.js';
import {
  ScheduleSuggestionsDto,
  ScheduleSuggestionsResponseDto,
} from './dto/schedule-suggestions.dto.js';
import { SchedulingService } from './scheduling.service.js';

@ApiTags('schedule')
@WorkspaceScoped()
@RequireRole(WorkspaceRole.Editor)
@Controller('workspaces/:workspaceId/schedule')
export class SchedulingController {
  constructor(private readonly scheduling: SchedulingService) {}

  @Post('suggestions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Best free posting times per account, from each platform's research-backed windows, within its daily cap and spacing",
  })
  @ApiOkResponse({ type: ScheduleSuggestionsResponseDto })
  suggestions(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Body() dto: ScheduleSuggestionsDto,
  ): Promise<ScheduleSuggestionsResponseDto> {
    return this.scheduling.suggest(ws.workspaceId, dto);
  }
}
