import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccountsService } from '../accounts/accounts.service.js';
import { AccountStatus } from '../accounts/enums/account-status.enum.js';
import { IntegrationsRegistry } from '../integrations/integrations.registry.js';
import { PostTarget } from '../posts/entities/post-target.entity.js';
import { TargetStatus } from '../posts/enums/post-status.enum.js';
import type {
  AccountOverviewDto,
  EngagementTotalsDto,
  MetricPointDto,
  OverviewResponseDto,
  TopPostDto,
} from './dto/analytics.dto.js';
import { PostMetricSnapshot } from './entities/post-metric-snapshot.entity.js';

/** Posts are tracked for this long after publishing. */
const TRACK_FOR_DAYS = 30;
/** Minimum gap between two snapshots of the same target; providers may ask for longer. */
const MIN_INTERVAL_MINUTES = 30;

const ENGAGEMENT_SQL =
  'COALESCE(t.likes,0) + COALESCE(t.reposts,0) + COALESCE(t.replies,0) + COALESCE(t.quotes,0)';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectRepository(PostTarget)
    private readonly targets: Repository<PostTarget>,
    @InjectRepository(PostMetricSnapshot)
    private readonly snapshots: Repository<PostMetricSnapshot>,
    private readonly accounts: AccountsService,
    private readonly registry: IntegrationsRegistry,
  ) {}

  /**
   * Captures fresh metrics for recently published targets: every workspace's
   * when called by the scheduler, or one workspace's for a manual refresh.
   * Returns how many targets were captured.
   */
  async collectDue(workspaceId?: string): Promise<number> {
    const qb = this.targets
      .createQueryBuilder('t')
      .innerJoinAndSelect('t.account', 'a')
      .where('t.status = :published', { published: TargetStatus.Published });
    if (workspaceId)
      qb.andWhere('a.workspaceId = :workspaceId', { workspaceId });
    const due = await qb
      .andWhere('t.externalId IS NOT NULL')
      .andWhere('a.status = :active', { active: AccountStatus.Active })
      .andWhere(`t.publishedAt > now() - make_interval(days => :days)`, {
        days: TRACK_FOR_DAYS,
      })
      .andWhere(
        `(t.metricsUpdatedAt IS NULL OR t.metricsUpdatedAt < now() - make_interval(mins => :mins))`,
        { mins: MIN_INTERVAL_MINUTES },
      )
      .getMany();

    const byAccount = new Map<string, PostTarget[]>();
    for (const target of due) {
      const { supportsMetrics, metricsIntervalMinutes } = this.registry.get(
        target.account.platform,
      ).capabilities;
      const readAgainAt =
        (target.metricsUpdatedAt?.getTime() ?? 0) +
        (metricsIntervalMinutes ?? MIN_INTERVAL_MINUTES) * 60_000;
      if (!supportsMetrics || readAgainAt > Date.now()) continue;
      byAccount.set(target.accountId, [
        ...(byAccount.get(target.accountId) ?? []),
        target,
      ]);
    }

    let captured = 0;
    for (const [accountId, targets] of byAccount) {
      try {
        captured += await this.collectForAccount(accountId, targets);
      } catch (error) {
        await this.accounts.recordFailure(targets[0].account, error);
        this.logger.warn(
          `Metrics for account ${accountId} failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    return captured;
  }

  async history(
    workspaceId: string,
    targetId: string,
  ): Promise<MetricPointDto[]> {
    const owned = await this.targets.exists({
      where: { id: targetId, account: { workspaceId } },
    });
    if (!owned) {
      throw new NotFoundException(`Target ${targetId} not found`);
    }
    return this.snapshots.find({
      where: { targetId },
      order: { capturedAt: 'ASC' },
      select: {
        capturedAt: true,
        likes: true,
        reposts: true,
        replies: true,
        quotes: true,
        views: true,
      },
    });
  }

  async overview(
    workspaceId: string,
    days: number,
  ): Promise<OverviewResponseDto> {
    const base = () =>
      this.targets
        .createQueryBuilder('t')
        .innerJoin('t.account', 'a')
        .where('a.workspaceId = :workspaceId', { workspaceId })
        .andWhere('t.status = :published', {
          published: TargetStatus.Published,
        })
        .andWhere(`t.publishedAt > now() - make_interval(days => :days)`, {
          days,
        });

    const rows = await base()
      .select('a.id', 'accountId')
      .addSelect('a.platform', 'platform')
      .addSelect('a.handle', 'handle')
      .addSelect('a.displayName', 'displayName')
      .addSelect('COUNT(*)::int', 'posts')
      .addSelect('COALESCE(SUM(t.likes),0)::int', 'likes')
      .addSelect('COALESCE(SUM(t.reposts),0)::int', 'reposts')
      .addSelect('COALESCE(SUM(t.replies),0)::int', 'replies')
      .addSelect('COALESCE(SUM(t.quotes),0)::int', 'quotes')
      .addSelect('COALESCE(SUM(t.views),0)::int', 'views')
      .addSelect(`COALESCE(SUM(${ENGAGEMENT_SQL}),0)::int`, 'engagement')
      .groupBy('a.id')
      .orderBy('engagement', 'DESC')
      .getRawMany<AccountOverviewDto>();

    const top = await base()
      .innerJoin('t.post', 'p')
      .select('t.id', 'targetId')
      .addSelect('p.id', 'postId')
      .addSelect('a.platform', 'platform')
      .addSelect('a.handle', 'handle')
      .addSelect('COALESCE(t.text, p.body)', 'text')
      .addSelect('t.externalUrl', 'externalUrl')
      .addSelect('t.publishedAt', 'publishedAt')
      .addSelect(`(${ENGAGEMENT_SQL})::int`, 'engagement')
      .orderBy('engagement', 'DESC')
      .addOrderBy('t.publishedAt', 'DESC')
      .limit(5)
      .getRawMany<TopPostDto>();

    const totals: EngagementTotalsDto = {
      posts: 0,
      likes: 0,
      reposts: 0,
      replies: 0,
      quotes: 0,
      views: 0,
      engagement: 0,
    };
    for (const row of rows) {
      for (const key of Object.keys(totals) as (keyof EngagementTotalsDto)[]) {
        totals[key] += row[key];
      }
    }
    return { days, totals, accounts: rows, topPosts: top };
  }

  private async collectForAccount(
    accountId: string,
    targets: PostTarget[],
  ): Promise<number> {
    const provider = this.registry.get(targets[0].account.platform);
    if (!provider.fetchMetrics) return 0;

    const credentials = await this.accounts.getCredentials(accountId);
    const metrics = await provider.fetchMetrics(
      credentials,
      targets.map((t) => t.externalId!),
    );

    const now = new Date();
    let captured = 0;
    for (const target of targets) {
      const m = metrics.get(target.externalId!);
      if (!m) continue;
      const values = {
        likes: m.likes ?? null,
        reposts: m.reposts ?? null,
        replies: m.replies ?? null,
        quotes: m.quotes ?? null,
        views: m.views ?? null,
      };
      await this.snapshots.save(
        this.snapshots.create({ targetId: target.id, raw: m.raw, ...values }),
      );
      await this.targets.update(target.id, {
        ...values,
        metricsUpdatedAt: now,
      });
      captured++;
    }
    return captured;
  }
}
