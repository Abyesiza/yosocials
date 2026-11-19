import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformApiError } from '../../common/http/http-client.js';
import { AccountsService } from '../accounts/accounts.service.js';
import { AccountStatus } from '../accounts/enums/account-status.enum.js';
import { IntegrationsRegistry } from '../integrations/integrations.registry.js';
import { PostTarget } from '../posts/entities/post-target.entity.js';
import { TargetStatus } from '../posts/enums/post-status.enum.js';
import { PostsService } from '../posts/posts.service.js';

const MAX_ATTEMPTS = 3;
const BATCH_SIZE = 20;
/** A target stuck in `publishing` this long was interrupted mid-send. */
const STUCK_AFTER_MINUTES = 10;

export interface PublishOutcome {
  targetId: string;
  status: TargetStatus;
  error?: string;
}

/**
 * Sends targets to their platforms. Every send starts by atomically
 * "claiming" rows (status → publishing) with `FOR UPDATE SKIP LOCKED`, so two
 * schedulers, or a scheduler and a "publish now" click, can never post the
 * same target twice.
 */
@Injectable()
export class PublishingService {
  private readonly logger = new Logger(PublishingService.name);

  constructor(
    @InjectRepository(PostTarget)
    private readonly targets: Repository<PostTarget>,
    private readonly accounts: AccountsService,
    private readonly posts: PostsService,
    private readonly registry: IntegrationsRegistry,
  ) {}

  /** Called by the scheduler: publishes every target whose time has come. */
  async publishDue(): Promise<PublishOutcome[]> {
    const ids = await this.claim(
      `"status" = 'scheduled' AND "scheduledAt" <= now()`,
    );
    return this.publishClaimed(ids);
  }

  /** Publishes a post's unpublished targets immediately. */
  async publishNow(postId: string): Promise<PublishOutcome[]> {
    const post = await this.posts.findOne(postId);
    this.posts.assertTextFits(
      post,
      post.targets.filter((t) => t.status !== TargetStatus.Published),
    );
    const ids = await this.claim(
      `"postId" = $1 AND "status" IN ('draft', 'scheduled', 'failed')`,
      [postId],
    );
    return this.publishClaimed(ids);
  }

  /**
   * Fails targets left in `publishing` by a crash. They are not retried
   * automatically: the platform may have received the post before the crash.
   */
  async failStuck(): Promise<number> {
    const result = await this.targets
      .createQueryBuilder()
      .update()
      .set({
        status: TargetStatus.Failed,
        lastError:
          'Publishing was interrupted. Check the platform before retrying, it may already be live.',
      })
      .where('status = :status', { status: TargetStatus.Publishing })
      .andWhere(`"updatedAt" < now() - make_interval(mins => :mins)`, {
        mins: STUCK_AFTER_MINUTES,
      })
      .execute();
    return result.affected ?? 0;
  }

  private async claim(
    where: string,
    params: unknown[] = [],
  ): Promise<string[]> {
    // Wrapped in a CTE so the driver returns plain rows (a bare UPDATE ...
    // RETURNING comes back from TypeORM as [rows, count]).
    const rows: { id: string }[] = await this.targets.query(
      `WITH claimed AS (
         UPDATE post_targets
            SET "status" = 'publishing', "attempts" = "attempts" + 1, "updatedAt" = now()
          WHERE id IN (
            SELECT id FROM post_targets
             WHERE ${where}
             ORDER BY "scheduledAt" NULLS FIRST
             LIMIT ${BATCH_SIZE}
             FOR UPDATE SKIP LOCKED)
        RETURNING id)
       SELECT id FROM claimed`,
      params,
    );
    return rows.map((r) => r.id);
  }

  private async publishClaimed(ids: string[]): Promise<PublishOutcome[]> {
    const outcomes: PublishOutcome[] = [];
    for (const id of ids) outcomes.push(await this.publishOne(id));
    return outcomes;
  }

  private async publishOne(targetId: string): Promise<PublishOutcome> {
    const target = await this.targets.findOneOrFail({
      where: { id: targetId },
      relations: { post: true, account: true },
    });
    const { account } = target;

    if (account.status === AccountStatus.NeedsReconnect) {
      return this.fail(
        target,
        `${account.handle} needs to be reconnected`,
        false,
      );
    }

    try {
      const provider = this.registry.get(account.platform);
      const credentials = await this.accounts.getCredentials(account.id);
      const result = await provider.publish(credentials, {
        text: target.effectiveText(),
        idempotencyKey: target.id,
      });

      await this.targets.update(target.id, {
        status: TargetStatus.Published,
        externalId: result.externalId,
        externalUrl: result.externalUrl ?? null,
        publishedAt: result.publishedAt,
        lastError: null,
      });
      this.logger.log(`Published ${target.id} to ${account.platform}`);
      return { targetId: target.id, status: TargetStatus.Published };
    } catch (error) {
      await this.accounts.recordFailure(account, error);
      const message = error instanceof Error ? error.message : String(error);
      const retryable = error instanceof PlatformApiError && error.retryable;
      this.logger.warn(`Publishing ${target.id} failed: ${message}`);
      return this.fail(target, message, retryable);
    }
  }

  /** Retryable failures go back on the schedule with backoff (2, 4, 8 min). */
  private async fail(
    target: PostTarget,
    message: string,
    retryable: boolean,
  ): Promise<PublishOutcome> {
    if (retryable && target.attempts < MAX_ATTEMPTS) {
      await this.targets.update(target.id, {
        status: TargetStatus.Scheduled,
        scheduledAt: new Date(Date.now() + 2 ** target.attempts * 60_000),
        lastError: message,
      });
      return {
        targetId: target.id,
        status: TargetStatus.Scheduled,
        error: message,
      };
    }
    await this.targets.update(target.id, {
      status: TargetStatus.Failed,
      lastError: message,
    });
    return { targetId: target.id, status: TargetStatus.Failed, error: message };
  }
}
