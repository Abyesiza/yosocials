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
import { CreatePostDto } from './dto/create-post.dto.js';
import { ListPostsQueryDto } from './dto/list-posts-query.dto.js';
import { PostResponseDto } from './dto/post-response.dto.js';
import { SchedulePostDto } from './dto/schedule-post.dto.js';
import { UpdatePostDto, UpdatePostTargetDto } from './dto/update-post.dto.js';
import { PostsService } from './posts.service.js';

@ApiTags('posts')
@Controller('posts')
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @Post()
  @ApiCreatedResponse({ type: PostResponseDto })
  async create(@Body() dto: CreatePostDto): Promise<PostResponseDto> {
    return PostResponseDto.from(await this.posts.create(dto));
  }

  @Get()
  async findAll(
    @Query() query: ListPostsQueryDto,
  ): Promise<Paginated<PostResponseDto>> {
    const page = await this.posts.findAll(query);
    return { ...page, items: page.items.map((p) => PostResponseDto.from(p)) };
  }

  @Get(':id')
  @ApiOkResponse({ type: PostResponseDto })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PostResponseDto> {
    return PostResponseDto.from(await this.posts.findOne(id));
  }

  @Patch(':id')
  @ApiOkResponse({ type: PostResponseDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePostDto,
  ): Promise<PostResponseDto> {
    return PostResponseDto.from(await this.posts.update(id, dto));
  }

  @Patch(':id/targets/:targetId')
  @ApiOkResponse({ type: PostResponseDto })
  async updateTarget(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('targetId', ParseUUIDPipe) targetId: string,
    @Body() dto: UpdatePostTargetDto,
  ): Promise<PostResponseDto> {
    return PostResponseDto.from(
      await this.posts.updateTarget(id, targetId, dto),
    );
  }

  @Post(':id/schedule')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: PostResponseDto })
  async schedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SchedulePostDto,
  ): Promise<PostResponseDto> {
    return PostResponseDto.from(await this.posts.schedule(id, dto));
  }

  @Post(':id/unschedule')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: PostResponseDto })
  async unschedule(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PostResponseDto> {
    return PostResponseDto.from(await this.posts.unschedule(id));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.posts.remove(id);
  }
}
