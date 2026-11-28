import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { AccountsService } from '../accounts/accounts.service.js';
import type { SocialAccount } from '../accounts/entities/social-account.entity.js';
import { IntegrationsRegistry } from '../integrations/integrations.registry.js';
import { PostTarget } from '../posts/entities/post-target.entity.js';
import { TargetStatus } from '../posts/enums/post-status.enum.js';
import { WorkspacesService } from '../workspaces/workspaces.service.js';
import type {
  ScheduleSuggestionsDto,
  ScheduleSuggestionsResponseDto,
} from './dto/schedule-suggestions.dto.js';
import {
  type BusyTime,
  type Slot,
  type SlotConflict,
  SlotFinder,
} from './slot-finder.js';
import { describeDay, describeMoment, localTime } from './time-zone.js';

/** Targets that count toward an account's caps and spacing. */
const BUSY_STATUSES = [
  TargetStatus.Scheduled,
  TargetStatus.Processing,
  TargetStatus.Publishing,
  TargetStatus.Published,
];
const DAY_MS = 86_400_000;
/** Covers any zone's day boundary and the longest spacing (24 hours). */
const BUSY_MARGIN_MS = 2 * DAY_MS;
/** How far ahead the guard looks for a free time to offer. */
const NEXT_FREE_DAYS = 14;

export interface Audience {
  timeZone: string;
  country: string | null;
}

/** A target about to be scheduled, or moved, at `scheduledAt`. */
export interface ScheduleCheck {
  /** Absent for targets not saved yet. */
  id?: string;
  account: SocialAccount;
  scheduledAt: Date;
}

/**
 * Picks posting times from each platform's research-backed windows, and
 * keeps every account within its daily cap and spacing.
 */
@Injectable()
export class SchedulingService {
  constructor(
    @InjectRepository(PostTarget)
    private readonly targets: Repository<PostTarget>,
    private readonly accounts: AccountsService,
    private readonly registry: IntegrationsRegistry,
    private readonly workspaces: WorkspacesService,
  ) {}

  async audience(workspaceId: string): Promise<Audience> {
    const workspace = await this.workspaces.get(workspaceId);
    return {
      // Unset workspaces count days in UTC; the web app asks people to choose a zone.
      timeZone: workspace.audienceTimeZone ?? 'UTC',
      country: workspace.audienceCountry,
    };
  }

  async suggest(
    workspaceId: string,
    dto: ScheduleSuggestionsDto,
  ): Promise<ScheduleSuggestionsResponseDto> {
    const accounts = await this.accounts.findMany(workspaceId, dto.accountIds);
    const timeZone =
      dto.timeZone ?? (await this.audience(workspaceId)).timeZone;
    const from = new Date(Math.max(dto.from?.getTime() ?? 0, Date.now()));
    const to = new Date(from.getTime() + dto.days * DAY_MS);
    const finders = await this.finders(accounts, timeZone, from, to);

    const byId = new Map(accounts.map((a) => [a.id, a]));
    const suggestions = [...new Set(dto.accountIds)].flatMap((id) =>
      finders
        .get(id)!
        .spread(from, to, dto.count)
        .map((slot) => ({
          accountId: id,
          platform: byId.get(id)!.platform,
          at: slot.at,
          reason: slot.reason,
        })),
    );
    return { timeZone, suggestions };
  }

  /**
   * One finder per account, already holding its scheduled and published
   * posts around [from, to], so every slot it hands out respects them.
   */
  async finders(
    accounts: SocialAccount[],
    timeZone: string,
    from: Date,
    to: Date,
    excludeTargetIds: string[] = [],
  ): Promise<Map<string, SlotFinder>> {
    const busy = await this.busy(
      accounts.map((a) => a.id),
      new Date(from.getTime() - BUSY_MARGIN_MS),
      new Date(to.getTime() + BUSY_MARGIN_MS),
      excludeTargetIds,
    );
    return new Map(
      accounts.map((account) => {
        const provider = this.registry.get(account.platform);
        return [
          account.id,
          new SlotFinder(
            {
              id: account.id,
              platformName: provider.displayName,
              policy: provider.capabilities.posting,
              busy: busy.get(account.id) ?? [],
            },
            { timeZone },
          ),
        ];
      }),
    );
  }

  /**
   * Rejects times that would break an account's daily cap or spacing, naming
   * the rule and the next free time. Drafts and "publish now" aren't checked.
   */
  async assertCanSchedule(
    workspaceId: string,
    checks: ScheduleCheck[],
  ): Promise<void> {
    if (checks.length === 0) return;
    const { timeZone } = await this.audience(workspaceId);
    const problems: string[] = [];
    for (const check of checks) {
      const from = check.scheduledAt;
      const to = new Date(
        Math.max(from.getTime(), Date.now()) + NEXT_FREE_DAYS * DAY_MS,
      );
      const finder = (
        await this.finders(
          [check.account],
          timeZone,
          from,
          to,
          check.id ? [check.id] : [],
        )
      ).get(check.account.id)!;
      const conflict = finder.conflict(check.scheduledAt);
      if (!conflict) continue;
      problems.push(
        this.conflictMessage(
          check.account,
          conflict,
          finder.next(from, to),
          timeZone,
        ),
      );
    }
    if (problems.length > 0) throw new BadRequestException(problems);
  }

  /** The best free time for the account from its audience's next day on (TikTok's daily cap). */
  async nextDaySlot(
    account: SocialAccount,
    excludeTargetId: string,
  ): Promise<Slot | null> {
    const { timeZone } = await this.audience(account.workspaceId);
    const from = new Date();
    const to = new Date(from.getTime() + 8 * DAY_MS);
    const finder = (
      await this.finders([account], timeZone, from, to, [excludeTargetId])
    ).get(account.id)!;
    const tomorrow = localTime(new Date(from.getTime() + DAY_MS), timeZone).day;
    return finder.next(from, to, tomorrow);
  }

  /** How the platform's rule reads to people, e.g. "kept to 1 a day, at least 18 hours apart". */
  ruleSummary(account: SocialAccount): string {
    const { maxPerDay, minSpacingMinutes } = this.registry.get(account.platform)
      .capabilities.posting;
    return `up to ${maxPerDay} a day, at least ${duration(minSpacingMinutes)} apart`;
  }

  private conflictMessage(
    account: SocialAccount,
    conflict: SlotConflict,
    next: Slot | null,
    timeZone: string,
  ): string {
    const { displayName, capabilities } = this.registry.get(account.platform);
    const who = `${displayName} posts from ${account.displayName || account.handle}`;
    const rule =
      conflict.kind === 'spacing'
        ? `${who} are kept at least ${duration(capabilities.posting.minSpacingMinutes)} apart, and another ${conflict.other.published ? 'went out' : 'is scheduled'} at ${describeMoment(conflict.other.at, timeZone)}.`
        : `${who} are kept to ${capabilities.posting.maxPerDay} a day, and ${describeDay(conflict.day)} already has ${conflict.count === 1 ? 'one' : conflict.count}.`;
    const offer = next
      ? `The next free time is ${describeMoment(next.at, timeZone)}.`
      : `There’s no free time in the next ${NEXT_FREE_DAYS} days. Choose a later date.`;
    return `${rule} ${offer}`;
  }

  private async busy(
    accountIds: string[],
    from: Date,
    to: Date,
    excludeTargetIds: string[],
  ): Promise<Map<string, BusyTime[]>> {
    const rows = await this.targets
      .createQueryBuilder('t')
      .select(['t.id', 't.accountId', 't.scheduledAt', 't.publishedAt'])
      .where({
        accountId: In(accountIds),
        status: In(BUSY_STATUSES),
        ...(excludeTargetIds.length > 0 && { id: Not(In(excludeTargetIds)) }),
      })
      .andWhere(
        'COALESCE(t.publishedAt, t.scheduledAt) BETWEEN :from AND :to',
        {
          from,
          to,
        },
      )
      .getMany();
    const result = new Map<string, BusyTime[]>();
    for (const row of rows) {
      const at = row.publishedAt ?? row.scheduledAt;
      if (!at) continue;
      const list = result.get(row.accountId) ?? [];
      list.push({ at, published: row.publishedAt !== null });
      result.set(row.accountId, list);
    }
    return result;
  }
}

/** 1080 → "18 hours", 90 → "90 minutes". */
export function duration(minutes: number): string {
  if (minutes % 60 !== 0) return `${minutes} minutes`;
  const hours = minutes / 60;
  return hours === 1 ? '1 hour' : `${hours} hours`;
}
