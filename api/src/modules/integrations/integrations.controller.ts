import { Controller, Get } from '@nestjs/common';
import { Public } from '@nestjs/authentication';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PlatformInfoDto } from './dto/platform-info.dto.js';
import { IntegrationsRegistry } from './integrations.registry.js';

@ApiTags('integrations')
@Public()
@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly registry: IntegrationsRegistry) {}

  @Get()
  @ApiOkResponse({ type: [PlatformInfoDto] })
  list(): PlatformInfoDto[] {
    return this.registry.list().map((p) => ({
      platform: p.platform,
      displayName: p.displayName,
      maxTextLength: p.capabilities.maxTextLength,
      lengthUnit: p.capabilities.lengthUnit,
      supportsMetrics: p.capabilities.supportsMetrics,
      connect: p.capabilities.connect,
      available: p.oauth?.isConfigured() ?? true,
      media: p.capabilities.media ?? null,
    }));
  }
}
