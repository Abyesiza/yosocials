import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AgentService } from './agent.service.js';
import {
  DraftVariantsDto,
  DraftVariantsResponseDto,
} from './dto/draft-variants.dto.js';
import {
  PlanCalendarDto,
  PlanCalendarResponseDto,
} from './dto/plan-calendar.dto.js';

@ApiTags('agent')
@Controller('agent')
export class AgentController {
  constructor(private readonly agent: AgentService) {}

  @Post('plan')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Plan a content calendar; saves the plan as draft posts',
  })
  @ApiOkResponse({ type: PlanCalendarResponseDto })
  plan(@Body() dto: PlanCalendarDto): Promise<PlanCalendarResponseDto> {
    return this.agent.planCalendar(dto);
  }

  @Post('variants')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Write one idea for several platforms; nothing is saved',
  })
  @ApiOkResponse({ type: DraftVariantsResponseDto })
  variants(@Body() dto: DraftVariantsDto): Promise<DraftVariantsResponseDto> {
    return this.agent.draftVariants(dto);
  }
}
