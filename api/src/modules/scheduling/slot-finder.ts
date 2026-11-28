import { createHash } from 'node:crypto';
import type {
  PostingPolicy,
  PostingWindow,
} from '../integrations/interfaces/platform-provider.interface.js';
import {
  clockMinutes,
  describeSlot,
  localTime,
  type LocalTime,
} from './time-zone.js';

/** Earliest a slot may be handed out, from now. */
export const MIN_LEAD_MINUTES = 10;
const STEP_MS = 15 * 60_000;
const MINUTE_MS = 60_000;

/** Another post from the account that caps and spacing count. */
export interface BusyTime {
  at: Date;
  /** Already posted (or going out), rather than scheduled. */
  published: boolean;
}

export interface SlotAccount {
  id: string;
  platformName: string;
  policy: PostingPolicy;
  busy: BusyTime[];
}

export interface SlotFinderOptions {
  /** The audience's IANA zone: windows and days are read in it. */
  timeZone: string;
  now?: Date;
  /** Minutes (±1–3) to move a slot by, so posts don't all go out on the quarter hour. */
  jitter?: (accountId: string, base: Date) => number;
}

export interface Slot {
  at: Date;
  reason: string;
}

/** Why a time breaks the account's caps or spacing. */
export type SlotConflict =
  | { kind: 'per_day'; day: string; count: number }
  | { kind: 'spacing'; other: BusyTime };

interface Candidate {
  at: Date;
  day: string;
  weight: number;
}

interface Booked extends BusyTime {
  day: string;
}

/** Stable per account and time, so suggestions don't move on every request. */
export function hashJitter(accountId: string, base: Date): number {
  const [a, b] = createHash('sha256')
    .update(`${accountId}:${base.getTime()}`)
    .digest();
  const minutes = 1 + (a % 3);
  return b % 2 === 0 ? minutes : -minutes;
}

function covers(window: PostingWindow, local: LocalTime): boolean {
  return (
    window.days.includes(local.weekday) &&
    local.minutes >= clockMinutes(window.start) &&
    local.minutes < clockMinutes(window.end)
  );
}

const STRENGTH: Record<number, (platform: string) => string> = {
  3: (p) => `one of ${p}’s strongest times`,
  2: (p) => `a good time for ${p}`,
  1: (p) => `a fair time for ${p}`,
};

/**
 * Hands out free posting times for one account: inside the platform's
 * windows, never in its `avoid` times or the past, within `maxPerDay` (per
 * audience-local day) and `minSpacingMinutes` of its other posts and of every
 * slot handed out before.
 */
export class SlotFinder {
  private readonly timeZone: string;
  private readonly now: Date;
  private readonly jitter: (accountId: string, base: Date) => number;
  private readonly booked: Booked[];

  constructor(
    private readonly account: SlotAccount,
    options: SlotFinderOptions,
  ) {
    this.timeZone = options.timeZone;
    this.now = options.now ?? new Date();
    this.jitter = options.jitter ?? hashJitter;
    this.booked = account.busy.map((b) => ({
      ...b,
      day: localTime(b.at, this.timeZone).day,
    }));
  }

  get policy(): PostingPolicy {
    return this.account.policy;
  }

  /** What stops `at` being used, or null when it fits. */
  conflict(at: Date): SlotConflict | null {
    return this.clash(at, localTime(at, this.timeZone).day);
  }

  private clash(at: Date, day: string): SlotConflict | null {
    // Never two posts in the same minute, whatever the policy.
    const spacingMs = Math.max(this.policy.minSpacingMinutes, 1) * MINUTE_MS;
    const near = this.booked
      .filter((b) => Math.abs(b.at.getTime() - at.getTime()) < spacingMs)
      .sort(
        (x, y) =>
          Math.abs(x.at.getTime() - at.getTime()) -
          Math.abs(y.at.getTime() - at.getTime()),
      )[0];
    if (near) {
      return {
        kind: 'spacing',
        other: { at: near.at, published: near.published },
      };
    }
    const count = this.booked.filter((b) => b.day === day).length;
    return count >= this.policy.maxPerDay
      ? { kind: 'per_day', day, count }
      : null;
  }

  /**
   * Books the best free time on the first audience-local day, from
   * `onOrAfterDay`, that has one. Null when nothing fits before `to`.
   */
  next(from: Date, to: Date, onOrAfterDay?: string): Slot | null {
    const free = this.candidates(from, to).filter(
      (c) =>
        (!onOrAfterDay || c.day >= onOrAfterDay) && !this.clash(c.at, c.day),
    );
    if (free.length === 0) return null;
    const day = free[0].day;
    return this.book(this.best(free.filter((c) => c.day === day))!);
  }

  /**
   * Books up to `count` times, one per day per round: strongest days first,
   * so several posts spread across the week instead of stacking on its best day.
   */
  spread(from: Date, to: Date, count: number): Slot[] {
    const candidates = this.candidates(from, to);
    const slots: Slot[] = [];
    let usedThisRound = new Set<string>();
    while (slots.length < count) {
      const free = candidates.filter(
        (c) => !usedThisRound.has(c.day) && !this.clash(c.at, c.day),
      );
      const pick = this.best(free);
      if (!pick) {
        if (usedThisRound.size === 0) break;
        usedThisRound = new Set();
        continue;
      }
      usedThisRound.add(pick.day);
      slots.push(this.book(pick));
    }
    return slots.sort((a, b) => a.at.getTime() - b.at.getTime());
  }

  /** Highest weight, then earliest. */
  private best(candidates: Candidate[]): Candidate | undefined {
    return candidates.reduce<Candidate | undefined>(
      (best, c) => (!best || c.weight > best.weight ? c : best),
      undefined,
    );
  }

  private book(candidate: Candidate): Slot {
    this.booked.push({
      at: candidate.at,
      day: candidate.day,
      published: false,
    });
    const strength = STRENGTH[candidate.weight] ?? STRENGTH[1];
    return {
      at: candidate.at,
      reason: `${describeSlot(candidate.at, this.timeZone)} is ${strength(this.account.platformName)}. Source: ${this.policy.source}.`,
    };
  }

  /** Every usable time in [from, to), in order, on a 15-minute grid plus jitter. */
  private candidates(from: Date, to: Date): Candidate[] {
    const earliest = Math.max(
      from.getTime(),
      this.now.getTime() + MIN_LEAD_MINUTES * MINUTE_MS,
    );
    const result: Candidate[] = [];
    // Zone offsets are whole quarter hours, so a UTC grid is a local one too.
    for (
      let base = Math.ceil(earliest / STEP_MS) * STEP_MS - STEP_MS;
      base < to.getTime();
      base += STEP_MS
    ) {
      const candidate = this.candidate(new Date(base), earliest, to.getTime());
      if (candidate) result.push(candidate);
    }
    return result;
  }

  private candidate(
    base: Date,
    earliest: number,
    end: number,
  ): Candidate | null {
    const shift = this.jitter(this.account.id, base);
    // A nudge back out of the window is turned into a nudge forward.
    for (const minutes of shift < 0 ? [shift, -shift] : [shift]) {
      const at = new Date(base.getTime() + minutes * MINUTE_MS);
      if (at.getTime() < earliest || at.getTime() >= end) continue;
      const local = localTime(at, this.timeZone);
      if (this.policy.avoid.some((w) => covers(w, local))) continue;
      const weight = Math.max(
        0,
        ...this.policy.windows
          .filter((w) => covers(w, local))
          .map((w) => w.weight),
      );
      if (weight > 0) return { at, day: local.day, weight };
    }
    return null;
  }
}
