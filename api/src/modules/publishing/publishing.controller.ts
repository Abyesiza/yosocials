import {
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
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
import { PublishOutcomeDto } from './dto/publish-result.dto.js';
import { PublishingService } from './publishing.service.js';

@ApiTags('posts')
@WorkspaceScoped()
@Controller('workspaces/:workspaceId/posts')
export class PublishingController {
  constructor(private readonly publishing: PublishingService) {}

  @Post(':id/publish')
  @RequireRole(WorkspaceRole.Editor)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Publish a post's unpublished targets right now" })
  @ApiOkResponse({ type: [PublishOutcomeDto] })
  publishNow(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PublishOutcomeDto[]> {
    return this.publishing.publishNow(ws.workspaceId, id);
  }
}
