import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { Paginated } from '../../common/dto/pagination-query.dto.js';
import { MediaStorageService } from '../../common/storage/media-storage.service.js';
import { MEDIA_TYPES } from '../../common/storage/media-types.js';
import { AccountsService } from '../accounts/accounts.service.js';
import type { SocialAccount } from '../accounts/entities/social-account.entity.js';
import type { PublishInput } from '../integrations/interfaces/platform-provider.interface.js';
import { IntegrationsRegistry } from '../integrations/integrations.registry.js';
import { countGraphemes } from '../integrations/parse-credentials.js';
import type { CreatePostDto } from './dto/create-post.dto.js';
import type { ListPostsQueryDto } from './dto/list-posts-query.dto.js';
import type { MediaItemDto } from './dto/media-item.dto.js';
import { PostResponseDto } from './dto/post-response.dto.js';
import type { SchedulePostDto } from './dto/schedule-post.dto.js';
import type {
  UpdatePostDto,
  UpdatePostTargetDto,
} from './dto/update-post.dto.js';
import { PostTarget } from './entities/post-target.entity.js';
import { Post, type PostMedia } from './entities/post.entity.js';
import { PostSource, TargetStatus } from './enums/post-status.enum.js';

/** Targets in these states can still be edited, scheduled or published. */
export const EDITABLE_STATUSES: readonly TargetStatus[] = [
  TargetStatus.Draft,
  TargetStatus.Scheduled,
  TargetStatus.Failed,
];

export interface CreatePostOptions {
  source?: PostSource;
  /** Keep every target as a draft even when it has a time (agent output). */
  asDraft?: boolean;
  /** The user creating it, recorded as the post's author. */
  createdById?: string | null;
}

/** Every method is scoped to one workspace; posts of others are "not found". */
@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post) private readonly posts: Repository<Post>,
    @InjectRepository(PostTarget)
    private readonly targets: Repository<PostTarget>,
    private readonly accounts: AccountsService,
    private readonly registry: IntegrationsRegistry,
    private readonly storage: MediaStorageService,
  ) {}

  async create(
    workspaceId: string,
    dto: CreatePostDto,
    options: CreatePostOptions = {},
  ): Promise<Post> {
    const accountIds = dto.targets.map((t) => t.accountId);
    if (new Set(accountIds).size !== accountIds.length) {
      throw new BadRequestException(
        'Each account can only be targeted once per post',
      );
    }
    // Also proves every account belongs to this workspace.
    const accounts = new Map(
      (await this.accounts.findMany(workspaceId, accountIds)).map((a) => [
        a.id,
        a,
      ]),
    );

    const targets: PostTarget[] = [];
    for (const t of dto.targets) {
      const account = accounts.get(t.accountId)!;
      const scheduledAt = t.scheduledAt ?? dto.scheduledAt ?? null;
      targets.push(
        this.targets.create({
          accountId: t.accountId,
          account,
          text: t.text ?? null,
          options: await this.parseOptions(account, t.options),
          scheduledAt,
          status:
            scheduledAt && !options.asDraft
              ? TargetStatus.Scheduled
              : TargetStatus.Draft,
        }),
      );
    }
    const post = this.posts.create({
      workspaceId,
      createdById: options.createdById ?? null,
      title: dto.title ?? null,
      body: dto.body,
      media: this.toMedia(workspaceId, dto.media ?? []),
      source: options.source ?? PostSource.Manual,
      targets,
    });

    this.assertTextFits(post, post.targets);
    this.assertReady(
      post,
      post.targets.filter((t) => t.status === TargetStatus.Scheduled),
    );
    const saved = await this.posts.save(post);
    return this.findOne(workspaceId, saved.id);
  }

  async findAll(
    workspaceId: string,
    query: ListPostsQueryDto,
  ): Promise<Paginated<Post>> {
    const qb = this.posts
      .createQueryBuilder('post')
      .select('post.id')
      .where('post.workspaceId = :workspaceId', { workspaceId });
    if (query.source) {
      qb.andWhere('post.source = :source', { source: query.source });
    }
    if (query.status) {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM post_targets t WHERE t."postId" = post.id AND t.status = :status)',
        { status: query.status },
      );
    }
    const [page, total] = await qb
      .orderBy('post.createdAt', 'DESC')
      .skip(query.offset)
      .take(query.limit)
      .getManyAndCount();

    const items = page.length
      ? await this.posts.find({
          where: { id: In(page.map((p) => p.id)) },
          relations: { targets: { account: true } },
          order: { createdAt: 'DESC' },
        })
      : [];
    return { items, total, limit: query.limit, offset: query.offset };
  }

  async findOne(workspaceId: string, id: string): Promise<Post> {
    const post = await this.posts.findOne({
      where: { id, workspaceId },
      relations: { targets: { account: true } },
    });
    if (!post) throw new NotFoundException(`Post ${id} not found`);
    return post;
  }

  async update(
    workspaceId: string,
    id: string,
    dto: UpdatePostDto,
  ): Promise<Post> {
    const post = await this.findOne(workspaceId, id);
    if (dto.title !== undefined) post.title = dto.title;
    if (dto.body !== undefined) {
      this.assertNotPublishing(post);
      post.body = dto.body;
    }
    const dropped: string[] = [];
    if (dto.media !== undefined) {
      this.assertNotPublishing(post);
      const media = this.toMedia(workspaceId, dto.media);
      dropped.push(
        ...post.media
          .filter((m) => !media.some((n) => n.path === m.path))
          .map((m) => m.path),
      );
      post.media = media;
    }
    this.assertTextFits(post, this.editable(post));
    this.assertReady(
      post,
      post.targets.filter((t) => t.status === TargetStatus.Scheduled),
    );
    await this.posts.save(post);
    // Only after the save, so a rejected edit never loses files.
    await this.storage.remove(dropped);
    return this.findOne(workspaceId, id);
  }

  async updateTarget(
    workspaceId: string,
    postId: string,
    targetId: string,
    dto: UpdatePostTargetDto,
  ): Promise<Post> {
    const post = await this.findOne(workspaceId, postId);
    const target = this.getTarget(post, targetId);
    if (!EDITABLE_STATUSES.includes(target.status)) {
      throw new ConflictException(
        `Target is ${target.status} and can't be edited`,
      );
    }
    if (dto.text !== undefined) target.text = dto.text;
    if (dto.options !== undefined) {
      target.options = await this.parseOptions(
        target.account,
        dto.options ?? undefined,
      );
    }
    if (dto.scheduledAt !== undefined) {
      target.scheduledAt = dto.scheduledAt;
      if (
        dto.scheduledAt === null &&
        target.status === TargetStatus.Scheduled
      ) {
        target.status = TargetStatus.Draft;
      }
    }
    this.assertTextFits(post, [target]);
    if (target.status === TargetStatus.Scheduled) {
      this.assertReady(post, [target]);
    }
    await this.targets.save(target);
    return this.findOne(workspaceId, postId);
  }

  /** Approves draft (or failed) targets for publishing at their scheduledAt. */
  async schedule(
    workspaceId: string,
    postId: string,
    dto: SchedulePostDto,
  ): Promise<Post> {
    const post = await this.findOne(workspaceId, postId);
    const chosen = dto.targetIds
      ? dto.targetIds.map((id) => this.getTarget(post, id))
      : post.targets.filter((t) => t.status === TargetStatus.Draft);

    if (chosen.length === 0) {
      throw new BadRequestException('No draft targets to schedule');
    }
    for (const target of chosen) {
      if (
        target.status !== TargetStatus.Draft &&
        target.status !== TargetStatus.Failed
      ) {
        throw new ConflictException(`Target ${target.id} is ${target.status}`);
      }
      if (!target.scheduledAt) {
        throw new BadRequestException(
          `Target ${target.id} (${target.account.platform}) has no scheduledAt`,
        );
      }
    }
    this.assertTextFits(post, chosen);
    this.assertReady(post, chosen);

    for (const target of chosen) {
      target.status = TargetStatus.Scheduled;
      target.attempts = 0;
      target.lastError = null;
    }
    await this.targets.save(chosen);
    return this.findOne(workspaceId, postId);
  }

  /** Moves scheduled targets back to draft. */
  async unschedule(workspaceId: string, postId: string): Promise<Post> {
    const post = await this.findOne(workspaceId, postId);
    await this.targets.update(
      { postId: post.id, status: TargetStatus.Scheduled },
      { status: TargetStatus.Draft },
    );
    return this.findOne(workspaceId, post.id);
  }

  /** Removes the post from Aby Socials. Already-published posts stay live. */
  async remove(workspaceId: string, id: string): Promise<void> {
    const post = await this.findOne(workspaceId, id);
    this.assertNotPublishing(post);
    const paths = post.media.map((m) => m.path);
    await this.posts.remove(post);
    await this.storage.remove(paths);
  }

  respond(post: Post): PostResponseDto {
    return PostResponseDto.from(post, (path) => this.storage.publicUrl(path));
  }

  /** What the platform receives for this target. */
  publishInput(post: Post, target: PostTarget): PublishInput {
    return {
      text: target.effectiveText(post),
      idempotencyKey: target.id,
      options: target.options,
      media: post.media.map((m) => ({
        kind: m.kind,
        url: this.storage.publicUrl(m.path),
        contentType: m.contentType,
        size: m.size,
        durationSec: m.durationSec ?? null,
      })),
    };
  }

  /**
   * Rejects targets their platform can't take as they are: too long, or
   * missing what it requires (TikTok: media and posting settings).
   */
  assertReady(post: Post, targets: PostTarget[]): void {
    this.assertTextFits(post, targets);
    const problems = targets.flatMap((target) => {
      const provider = this.registry.get(target.account.platform);
      return (
        provider.readinessIssues?.(this.publishInput(post, target)) ?? []
      ).map(
        (issue) =>
          `${provider.displayName} (${target.account.handle}): ${issue}`,
      );
    });
    if (problems.length > 0) throw new BadRequestException(problems);
  }

  /** Rejects text that's longer than a platform allows. */
  assertTextFits(post: Post, targets: PostTarget[]): void {
    const problems = targets.flatMap((target) => {
      const issue = this.textLengthIssue(
        target.effectiveText(post),
        target.account,
      );
      return issue ? [issue] : [];
    });
    if (problems.length > 0) throw new BadRequestException(problems);
  }

  textLengthIssue(text: string, account: SocialAccount): string | null {
    const { capabilities, displayName } = this.registry.get(account.platform);
    const length =
      capabilities.lengthUnit === 'graphemes'
        ? countGraphemes(text)
        : text.length;
    return length > capabilities.maxTextLength
      ? `${displayName} (${account.handle}) allows ${capabilities.maxTextLength} ${capabilities.lengthUnit}; this text has ${length}`
      : null;
  }

  private async parseOptions(
    account: SocialAccount,
    raw: Record<string, unknown> | undefined,
  ): Promise<Record<string, unknown> | null> {
    if (raw === undefined) return null;
    const provider = this.registry.get(account.platform);
    if (!provider.parseTargetOptions) {
      throw new BadRequestException(
        `${provider.displayName} has no extra post settings`,
      );
    }
    return provider.parseTargetOptions(raw);
  }

  /** Uploads must come from this workspace; one video, or images only. */
  private toMedia(workspaceId: string, items: MediaItemDto[]): PostMedia[] {
    const media = items.map((m): PostMedia => {
      if (!m.path.startsWith(`${workspaceId}/`)) {
        throw new BadRequestException(
          'Media must be uploaded to this workspace',
        );
      }
      const kind = MEDIA_TYPES[m.contentType].kind;
      return {
        path: m.path,
        kind,
        contentType: m.contentType,
        size: m.size,
        durationSec: kind === 'video' ? (m.durationSec ?? null) : null,
      };
    });
    if (new Set(media.map((m) => m.path)).size !== media.length) {
      throw new BadRequestException('The same file is attached twice');
    }
    const videos = media.filter((m) => m.kind === 'video').length;
    if (videos > 0 && media.length > 1) {
      throw new BadRequestException(
        'Attach one video, or images only. Videos and images can’t be mixed.',
      );
    }
    return media;
  }

  private editable(post: Post): PostTarget[] {
    return post.targets.filter((t) => EDITABLE_STATUSES.includes(t.status));
  }

  private getTarget(post: Post, targetId: string): PostTarget {
    const target = post.targets.find((t) => t.id === targetId);
    if (!target) {
      throw new NotFoundException(
        `Target ${targetId} not found on post ${post.id}`,
      );
    }
    return target;
  }

  private assertNotPublishing(post: Post): void {
    if (post.targets.some((t) => t.status === TargetStatus.Publishing)) {
      throw new ConflictException('This post is being published right now');
    }
  }
}
