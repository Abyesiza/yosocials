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
  Query,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Paginated } from '../../common/dto/pagination-query.dto.js';
import {
  CurrentWorkspace,
  RequireRole,
  WorkspaceScoped,
} from '../workspaces/decorators/workspace.decorators.js';
import { WorkspaceRole } from '../workspaces/enums/workspace-role.enum.js';
import type { WorkspaceContext } from '../workspaces/interfaces/workspace-context.interface.js';
import { CreatePostDto } from './dto/create-post.dto.js';
import { ListPostsQueryDto } from './dto/list-posts-query.dto.js';
import { PostResponseDto } from './dto/post-response.dto.js';
import { SchedulePostDto } from './dto/schedule-post.dto.js';
import { UpdatePostDto, UpdatePostTargetDto } from './dto/update-post.dto.js';
import { PostsService } from './posts.service.js';

/** Viewers read; editors and up write. */
@ApiTags('posts')
@WorkspaceScoped()
@Controller('workspaces/:workspaceId/posts')
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @Post()
  @RequireRole(WorkspaceRole.Editor)
  @ApiCreatedResponse({ type: PostResponseDto })
  async create(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Body() dto: CreatePostDto,
  ): Promise<PostResponseDto> {
    return this.posts.respond(
      await this.posts.create(ws.workspaceId, dto, { createdById: ws.userId }),
    );
  }

  @Get()
  async findAll(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Query() query: ListPostsQueryDto,
  ): Promise<Paginated<PostResponseDto>> {
    const page = await this.posts.findAll(ws.workspaceId, query);
    return { ...page, items: page.items.map((p) => this.posts.respond(p)) };
  }

  @Get(':id')
  @ApiOkResponse({ type: PostResponseDto })
  async findOne(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PostResponseDto> {
    return this.posts.respond(await this.posts.findOne(ws.workspaceId, id));
  }

  @Patch(':id')
  @RequireRole(WorkspaceRole.Editor)
  @ApiOkResponse({ type: PostResponseDto })
  async update(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePostDto,
  ): Promise<PostResponseDto> {
    return this.posts.respond(await this.posts.update(ws.workspaceId, id, dto));
  }

  @Patch(':id/targets/:targetId')
  @RequireRole(WorkspaceRole.Editor)
  @ApiOkResponse({ type: PostResponseDto })
  async updateTarget(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('targetId', ParseUUIDPipe) targetId: string,
    @Body() dto: UpdatePostTargetDto,
  ): Promise<PostResponseDto> {
    return this.posts.respond(
      await this.posts.updateTarget(ws.workspaceId, id, targetId, dto),
    );
  }

  @Post(':id/schedule')
  @RequireRole(WorkspaceRole.Editor)
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: PostResponseDto })
  async schedule(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SchedulePostDto,
  ): Promise<PostResponseDto> {
    return this.posts.respond(
      await this.posts.schedule(ws.workspaceId, id, dto),
    );
  }

  @Post(':id/unschedule')
  @RequireRole(WorkspaceRole.Editor)
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: PostResponseDto })
  async unschedule(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PostResponseDto> {
    return this.posts.respond(await this.posts.unschedule(ws.workspaceId, id));
  }

  @Delete(':id')
  @RequireRole(WorkspaceRole.Editor)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  remove(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.posts.remove(ws.workspaceId, id);
  }
}
