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
import { CreateUploadDto, UploadTicketDto } from './dto/media-item.dto.js';

@ApiTags('media')
@WorkspaceScoped()
@Controller('workspaces/:workspaceId/media')
export class MediaController {
  constructor(private readonly storage: MediaStorageService) {}

  @Post('uploads')
  @RequireRole(WorkspaceRole.Editor)
  @ApiOperation({
    summary:
      'Get a signed URL to upload a video or image to, then attach its path to a post',
  })
  @ApiCreatedResponse({ type: UploadTicketDto })
  createUpload(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Body() dto: CreateUploadDto,
  ): Promise<UploadTicketDto> {
    return this.storage.createUpload(ws.workspaceId, dto.contentType, dto.size);
  }
}
