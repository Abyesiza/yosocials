import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentWorkspace,
  RequireRole,
  WorkspaceScoped,
} from '../workspaces/decorators/workspace.decorators.js';
import { WorkspaceRole } from '../workspaces/enums/workspace-role.enum.js';
import type { WorkspaceContext } from '../workspaces/interfaces/workspace-context.interface.js';
import { AgentService } from './agent.service.js';
import { AgentCapabilitiesDto } from './dto/agent-capabilities.dto.js';
import {
  DraftVariantsDto,
  DraftVariantsResponseDto,
} from './dto/draft-variants.dto.js';
import {
  PlanCalendarDto,
  PlanCalendarResponseDto,
} from './dto/plan-calendar.dto.js';

@ApiTags('agent')
@WorkspaceScoped()
@RequireRole(WorkspaceRole.Editor)
@Controller('workspaces/:workspaceId/agent')
export class AgentController {
  constructor(private readonly agent: AgentService) {}

  @Get('capabilities')
  @ApiOperation({ summary: 'What the AI can do here, e.g. search the web' })
  @ApiOkResponse({ type: AgentCapabilitiesDto })
  capabilities(): AgentCapabilitiesDto {
    return this.agent.capabilities();
  }

  @Post('plan')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Plan a content calendar; saves the plan as draft posts',
  })
  @ApiOkResponse({ type: PlanCalendarResponseDto })
  plan(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Body() dto: PlanCalendarDto,
  ): Promise<PlanCalendarResponseDto> {
    return this.agent.planCalendar(ws.workspaceId, dto);
  }

  @Post('variants')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Write one idea for several platforms; nothing is saved',
  })
  @ApiOkResponse({ type: DraftVariantsResponseDto })
  variants(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Body() dto: DraftVariantsDto,
  ): Promise<DraftVariantsResponseDto> {
    return this.agent.draftVariants(ws.workspaceId, dto);
  }
}
