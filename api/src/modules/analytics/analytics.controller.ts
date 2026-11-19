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
import { AnalyticsService } from './analytics.service.js';
import {
  MetricPointDto,
  OverviewQueryDto,
  OverviewResponseDto,
  RefreshResponseDto,
} from './dto/analytics.dto.js';

@ApiTags('analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('overview')
  @ApiOkResponse({ type: OverviewResponseDto })
  overview(@Query() query: OverviewQueryDto): Promise<OverviewResponseDto> {
    return this.analytics.overview(query.days);
  }

  @Get('targets/:targetId/history')
  @ApiOkResponse({ type: [MetricPointDto] })
  history(
    @Param('targetId', ParseUUIDPipe) targetId: string,
  ): Promise<MetricPointDto[]> {
    return this.analytics.history(targetId);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: RefreshResponseDto })
  async refresh(): Promise<RefreshResponseDto> {
    return { captured: await this.analytics.collectDue() };
  }
}
