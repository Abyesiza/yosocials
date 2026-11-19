import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, type SelectQueryBuilder } from 'typeorm';
import type { Paginated } from '../../common/dto/pagination-query.dto.js';
import type { Platform } from '../../common/enums/platform.enum.js';
import { PostTargetResponseDto } from '../posts/dto/post-response.dto.js';
import { PostTarget } from '../posts/entities/post-target.entity.js';
import { TargetStatus } from '../posts/enums/post-status.enum.js';
import type {
  CalendarQueryDto,
  FeedItemDto,
  FeedQueryDto,
} from './dto/feed.dto.js';

const MAX_CALENDAR_DAYS = 62;

/**
 * Read-only views across every account: the unified feed (what's been
 * published, newest first) and the content calendar (what's planned).
 */
@Injectable()
export class FeedService {
  constructor(
    @InjectRepository(PostTarget)
    private readonly targets: Repository<PostTarget>,
  ) {}

  async feed(
    workspaceId: string,
    query: FeedQueryDto,
  ): Promise<Paginated<FeedItemDto>> {
    const qb = this.base(workspaceId, query.platform)
      .andWhere('t.status = :published', { published: TargetStatus.Published })
      .orderBy('t.publishedAt', 'DESC')
      .skip(query.offset)
      .take(query.limit);
    if (query.accountId)
      qb.andWhere('t.accountId = :accountId', { accountId: query.accountId });

    const [rows, total] = await qb.getManyAndCount();
    return {
      items: rows.map((t) => this.toItem(t)),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async calendar(
    workspaceId: string,
    query: CalendarQueryDto,
  ): Promise<FeedItemDto[]> {
    const days = (query.to.getTime() - query.from.getTime()) / 86_400_000;
    if (days <= 0 || days > MAX_CALENDAR_DAYS) {
      throw new BadRequestException(
        `"to" must be after "from" and at most ${MAX_CALENDAR_DAYS} days later`,
      );
    }
    const rows = await this.base(workspaceId, query.platform)
      .andWhere(
        new Brackets((w) =>
          w
            .where('t.scheduledAt BETWEEN :from AND :to')
            .orWhere('t.publishedAt BETWEEN :from AND :to'),
        ),
        { from: query.from, to: query.to },
      )
      .orderBy('COALESCE(t.publishedAt, t.scheduledAt)', 'ASC')
      .getMany();
    return rows.map((t) => this.toItem(t));
  }

  private base(
    workspaceId: string,
    platform?: Platform,
  ): SelectQueryBuilder<PostTarget> {
    const qb = this.targets
      .createQueryBuilder('t')
      .innerJoinAndSelect('t.post', 'p')
      .innerJoinAndSelect('t.account', 'a')
      .where('p.workspaceId = :workspaceId', { workspaceId });
    if (platform) qb.andWhere('a.platform = :platform', { platform });
    return qb;
  }

  private toItem(target: PostTarget): FeedItemDto {
    return Object.assign(PostTargetResponseDto.from(target, target.post), {
      postId: target.post.id,
      postTitle: target.post.title,
    });
  }
}
