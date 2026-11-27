import { Body, Controller, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MediaStorageService } from '../../common/storage/media-storage.service.js';
import {
  CurrentWorkspace,
  RequireRole,
  WorkspaceScoped,
} from '../workspaces/decorators/workspace.decorators.js';
import { WorkspaceRole } from '../workspaces/enums/workspace-role.enum.js';
import type { WorkspaceContext } from '../workspaces/interfaces/workspace-context.interface.js';
import { ReservedUploadsDto, ReserveUploadsDto } from './dto/media-item.dto.js';

@ApiTags('media')
@WorkspaceScoped()
@Controller('workspaces/:workspaceId/media')
export class MediaController {
  constructor(private readonly storage: MediaStorageService) {}

  @Post('uploads')
  @RequireRole(WorkspaceRole.Editor)
  @ApiOperation({
    summary:
      'Called by the web app’s UploadThing route: checks the upload is allowed and names each file',
  })
  @ApiCreatedResponse({ type: ReservedUploadsDto })
  reserve(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Body() dto: ReserveUploadsDto,
  ): ReservedUploadsDto {
    return { customIds: this.storage.reserve(ws.workspaceId, dto.files) };
  }
}
