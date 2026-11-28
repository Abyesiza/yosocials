import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformApiError } from '../../common/http/http-client.js';
import { AccountsService } from '../accounts/accounts.service.js';
import { AccountStatus } from '../accounts/enums/account-status.enum.js';
import { IntegrationsRegistry } from '../integrations/integrations.registry.js';
import { PostTarget } from '../posts/entities/post-target.entity.js';
import { TargetStatus } from '../posts/enums/post-status.enum.js';
import { EDITABLE_STATUSES, PostsService } from '../posts/posts.service.js';
import { SchedulingService } from '../scheduling/scheduling.service.js';
import { describeMoment } from '../scheduling/time-zone.js';

const MAX_ATTEMPTS = 3;
const BATCH_SIZE = 20;
/** A target stuck in `publishing` this long was interrupted mid-send. */
const STUCK_AFTER_MINUTES = 10;
/** How long to keep checking a platform's asynchronous publish (TikTok inbox drafts). */
const PROCESSING_WINDOW_DAYS = 7;

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
    private readonly scheduling: SchedulingService,
  ) {}

  /** Called by the scheduler: publishes every target whose time has come. */
  async publishDue(): Promise<PublishOutcome[]> {
    const ids = await this.claim(
      `"status" = 'scheduled' AND "scheduledAt" <= now()`,
    );
    return this.publishClaimed(ids);
  }

  /** Publishes a post's unpublished targets immediately. */
  async publishNow(
    workspaceId: string,
    postId: string,
  ): Promise<PublishOutcome[]> {
    // Scoped lookup: a post from another workspace is "not found".
    const post = await this.posts.findOne(workspaceId, postId);
    this.posts.assertReady(
      post,
      post.targets.filter((t) => EDITABLE_STATUSES.includes(t.status)),
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
          'Publishing was interrupted. It may already be live, so check the platform before you try again.',
      })
      .where('status = :status', { status: TargetStatus.Publishing })
      .andWhere(`"updatedAt" < now() - make_interval(mins => :mins)`, {
        mins: STUCK_AFTER_MINUTES,
      })
      .execute();
    return result.affected ?? 0;
  }

  /**
   * Asks platforms how their asynchronous publishes went: all processing
   * targets (scheduler), or one post's (the post page, which also works
   * where the scheduler doesn't run).
   */
  async syncProcessing(
    scope: { workspaceId: string; postId: string } | null = null,
  ): Promise<PublishOutcome[]> {
    if (scope) await this.posts.findOne(scope.workspaceId, scope.postId);
    const processing = await this.targets.find({
      where: {
        status: TargetStatus.Processing,
        ...(scope && { postId: scope.postId }),
      },
      relations: { account: true },
      take: scope ? undefined : BATCH_SIZE * 5,
    });
    const outcomes: PublishOutcome[] = [];
    for (const target of processing) {
      outcomes.push(await this.syncOne(target));
    }
    return outcomes;
  }

  private async syncOne(target: PostTarget): Promise<PublishOutcome> {
    const provider = this.registry.get(target.account.platform);
    const done = (status: TargetStatus, error?: string) => ({
      targetId: target.id,
      status,
      ...(error && { error }),
    });
    if (!provider.checkPublish || !target.externalId) {
      await this.targets.update(target.id, { status: TargetStatus.Published });
      return done(TargetStatus.Published);
    }
    try {
      const check = await provider.checkPublish(
        await this.accounts.getCredentials(target.accountId),
        target.externalId,
      );
      const expired =
        (target.publishedAt?.getTime() ?? 0) <
        Date.now() - PROCESSING_WINDOW_DAYS * 86_400_000;

      if (check.state === 'published') {
        await this.targets.update(target.id, {
          status: TargetStatus.Published,
          externalId: check.externalId ?? target.externalId,
          externalUrl: check.externalUrl ?? target.externalUrl,
          lastError: null,
        });
        return done(TargetStatus.Published);
      }
      if (check.state === 'failed') {
        await this.targets.update(target.id, {
          status: TargetStatus.Failed,
          lastError: check.reason,
        });
        return done(TargetStatus.Failed, check.reason);
      }
      if (check.state === 'in_inbox' && expired) {
        // Delivered; the creator never posted it from the app, or posted it privately.
        await this.targets.update(target.id, {
          status: TargetStatus.Published,
          lastError: `Sent to the ${provider.displayName} inbox, but we couldn’t confirm it was posted.`,
        });
        return done(TargetStatus.Published);
      }
      if (expired) {
        const reason = `${provider.displayName} didn’t finish processing this post within ${PROCESSING_WINDOW_DAYS} days. Try publishing it again.`;
        await this.targets.update(target.id, {
          status: TargetStatus.Failed,
          lastError: reason,
        });
        return done(TargetStatus.Failed, reason);
      }
      const note =
        check.state === 'in_inbox'
          ? `Waiting in the ${provider.displayName} inbox: open the notification in the app to finish posting.`
          : null;
      if (note !== target.lastError) {
        await this.targets.update(target.id, { lastError: note });
      }
      return done(TargetStatus.Processing);
    } catch (error) {
      await this.accounts.recordFailure(target.account, error);
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Checking ${target.id} failed: ${message}`);
      return done(TargetStatus.Processing, message);
    }
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
        `${account.handle} needs to be reconnected. Reconnect the account, then publish again.`,
        false,
      );
    }

    try {
      const provider = this.registry.get(account.platform);
      const credentials = await this.accounts.getCredentials(account.id);
      const result = await provider.publish(
        credentials,
        this.posts.publishInput(target.post, target),
      );
      const status = result.processing
        ? TargetStatus.Processing
        : TargetStatus.Published;

      await this.targets.update(target.id, {
        status,
        externalId: result.externalId,
        externalUrl: result.externalUrl ?? null,
        publishedAt: result.publishedAt,
        lastError: null,
      });
      this.logger.log(`Sent ${target.id} to ${account.platform} (${status})`);
      return { targetId: target.id, status };
    } catch (error) {
      await this.accounts.recordFailure(account, error);
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Publishing ${target.id} failed: ${message}`);
      if (!(error instanceof PlatformApiError)) {
        return this.fail(target, message, false);
      }
      if (error.dailyLimitReached && target.attempts < MAX_ATTEMPTS) {
        return this.postponeToNextDay(target, message);
      }
      return this.fail(target, message, error.retryable, error.retryAfterMs);
    }
  }

  /**
   * The platform's own daily cap was hit (TikTok): move the post to the
   * account's best free time on the next day instead of failing it.
   */
  private async postponeToNextDay(
    target: PostTarget,
    message: string,
  ): Promise<PublishOutcome> {
    const slot = await this.scheduling.nextDaySlot(target.account, target.id);
    if (!slot) return this.fail(target, message, false);
    const { timeZone } = await this.scheduling.audience(
      target.account.workspaceId,
    );
    const { displayName } = this.registry.get(target.account.platform);
    const note = `${target.account.displayName || target.account.handle} reached ${displayName}’s daily posting limit, so we moved this post to ${describeMoment(slot.at, timeZone)}.`;
    await this.targets.update(target.id, {
      status: TargetStatus.Scheduled,
      scheduledAt: slot.at,
      scheduleReason: slot.reason,
      lastError: note,
    });
    return { targetId: target.id, status: TargetStatus.Scheduled, error: note };
  }

  /**
   * Retryable failures go back on the schedule with backoff (2, 4, 8 min),
   * or later when the platform said how long to wait.
   */
  private async fail(
    target: PostTarget,
    message: string,
    retryable: boolean,
    retryAfterMs = 0,
  ): Promise<PublishOutcome> {
    if (retryable && target.attempts < MAX_ATTEMPTS) {
      const backoffMs = 2 ** target.attempts * 60_000;
      await this.targets.update(target.id, {
        status: TargetStatus.Scheduled,
        scheduledAt: new Date(Date.now() + Math.max(backoffMs, retryAfterMs)),
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
