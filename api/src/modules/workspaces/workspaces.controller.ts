import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { User } from '../users/entities/user.entity.js';
import {
  CurrentWorkspace,
  RequireRole,
  WorkspaceScoped,
} from './decorators/workspace.decorators.js';
import {
  AddMemberDto,
  CreateWorkspaceDto,
  MemberResponseDto,
  UpdateMemberDto,
  UpdateWorkspaceDto,
  WorkspaceResponseDto,
} from './dto/workspace.dto.js';
import { WorkspaceRole } from './enums/workspace-role.enum.js';
import type { WorkspaceContext } from './interfaces/workspace-context.interface.js';
import { WorkspacesService } from './workspaces.service.js';

@ApiTags('workspaces')
@ApiBearerAuth()
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Get()
  @ApiOkResponse({ type: [WorkspaceResponseDto] })
  async list(@CurrentUser() user: User): Promise<WorkspaceResponseDto[]> {
    const memberships = await this.workspaces.listForUser(user.id);
    return memberships.map((m) =>
      WorkspaceResponseDto.from(m.workspace, m.role),
    );
  }

  @Post()
  @ApiCreatedResponse({ type: WorkspaceResponseDto })
  async create(
    @CurrentUser() user: User,
    @Body() dto: CreateWorkspaceDto,
  ): Promise<WorkspaceResponseDto> {
    const workspace = await this.workspaces.create(user.id, dto);
    return WorkspaceResponseDto.from(workspace, WorkspaceRole.Owner);
  }
}

/** Routes inside one workspace: `/workspaces/:workspaceId/...`. */
@ApiTags('workspaces')
@WorkspaceScoped()
@Controller('workspaces/:workspaceId')
export class WorkspaceController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Get()
  @ApiOkResponse({ type: WorkspaceResponseDto })
  async get(
    @CurrentWorkspace() ctx: WorkspaceContext,
  ): Promise<WorkspaceResponseDto> {
    return WorkspaceResponseDto.from(
      await this.workspaces.get(ctx.workspaceId),
      ctx.role,
    );
  }

  @Patch()
  @RequireRole(WorkspaceRole.Admin)
  @ApiOkResponse({ type: WorkspaceResponseDto })
  async rename(
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Body() dto: UpdateWorkspaceDto,
  ): Promise<WorkspaceResponseDto> {
    const workspace = await this.workspaces.rename(ctx.workspaceId, dto.name);
    return WorkspaceResponseDto.from(workspace, ctx.role);
  }

  @Delete()
  @RequireRole(WorkspaceRole.Owner)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description: 'Deletes the workspace with its accounts, posts and analytics',
  })
  remove(@CurrentWorkspace() ctx: WorkspaceContext): Promise<void> {
    return this.workspaces.remove(ctx.workspaceId);
  }

  @Get('members')
  @ApiOkResponse({ type: [MemberResponseDto] })
  async members(
    @CurrentWorkspace() ctx: WorkspaceContext,
  ): Promise<MemberResponseDto[]> {
    return (await this.workspaces.listMembers(ctx.workspaceId)).map((m) =>
      MemberResponseDto.from(m),
    );
  }

  @Post('members')
  @RequireRole(WorkspaceRole.Admin)
  @ApiCreatedResponse({ type: MemberResponseDto })
  async addMember(
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Body() dto: AddMemberDto,
  ): Promise<MemberResponseDto> {
    return MemberResponseDto.from(await this.workspaces.addMember(ctx, dto));
  }

  @Patch('members/:userId')
  @RequireRole(WorkspaceRole.Admin)
  @ApiOkResponse({ type: MemberResponseDto })
  async updateMember(
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateMemberDto,
  ): Promise<MemberResponseDto> {
    return MemberResponseDto.from(
      await this.workspaces.updateMember(ctx, userId, dto),
    );
  }

  /** Admins remove others; any member can remove themselves to leave. */
  @Delete('members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  removeMember(
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<void> {
    return this.workspaces.removeMember(ctx, userId);
  }
}
