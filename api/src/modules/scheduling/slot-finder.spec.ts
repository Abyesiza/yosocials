import type { PostingPolicy } from '../integrations/interfaces/platform-provider.interface.js';
import { hashJitter, SlotFinder, type BusyTime } from './slot-finder.js';
import { describeMoment, localTime, zoneName } from './time-zone.js';

const ALL = [0, 1, 2, 3, 4, 5, 6];

// X's policy, as declared by its provider.
const X: PostingPolicy = {
  maxPerDay: 3,
  minSpacingMinutes: 120,
  windows: [
    { days: [2, 3, 4], start: '08:00', end: '11:00', weight: 3 },
    { days: [1, 5], start: '08:00', end: '11:00', weight: 2 },
    { days: [1, 2, 3, 4], start: '12:00', end: '17:00', weight: 1 },
  ],
  avoid: [
    { days: ALL, start: '22:00', end: '24:00', weight: 1 },
    { days: ALL, start: '00:00', end: '07:00', weight: 1 },
    { days: [6], start: '00:00', end: '24:00', weight: 1 },
  ],
  source:
    'Buffer 2026, Hootsuite 2025 and Sprout Social 2026 studies of X posts',
  limits: [],
};

const MONDAY = new Date('2026-11-30T00:00:00Z');
const DAY = 86_400_000;

function finder(
  policy: PostingPolicy,
  timeZone: string,
  options: { now?: Date; busy?: BusyTime[]; jitter?: number } = {},
) {
  return new SlotFinder(
    { id: 'acc-1', platformName: 'X', policy, busy: options.busy ?? [] },
    {
      timeZone,
      now: options.now ?? MONDAY,
      jitter: () => options.jitter ?? 0,
    },
  );
}

const after = (from: Date, days: number) =>
  new Date(from.getTime() + days * DAY);

describe('SlotFinder', () => {
  it('picks the strongest window in the audience’s time zone, with a reason', () => {
    const slot = finder(X, 'Africa/Kampala').next(
      MONDAY,
      after(MONDAY, 7),
      '2026-12-01',
    );
    expect(slot?.at.toISOString()).toBe('2026-12-01T05:00:00.000Z');
    expect(slot?.reason).toBe(
      'Tuesday 08:00 (EAT) is one of X’s strongest times. Source: Buffer 2026, Hootsuite 2025 and Sprout Social 2026 studies of X posts.',
    );
  });

  it.each([
    ['Africa/Kampala', '05:00', 'EAT'],
    ['Africa/Lagos', '07:00', 'WAT'],
    ['Africa/Kigali', '06:00', 'CAT'],
    ['Africa/Johannesburg', '06:00', 'SAST'],
    ['Africa/Accra', '08:00', 'GMT'],
  ])('reads windows in %s', (timeZone, utc, name) => {
    const slot = finder(X, timeZone).next(
      MONDAY,
      after(MONDAY, 7),
      '2026-12-01',
    );
    expect(slot?.at.toISOString()).toBe(`2026-12-01T${utc}:00.000Z`);
    expect(slot?.reason).toContain(`Tuesday 08:00 (${name})`);
  });

  it('follows daylight saving time (Europe/London)', () => {
    const before = new Date('2027-03-22T00:00:00Z');
    const winter = finder(X, 'Europe/London', { now: before }).next(
      before,
      after(before, 2),
      '2027-03-23',
    );
    expect(winter?.at.toISOString()).toBe('2027-03-23T08:00:00.000Z');
    expect(winter?.reason).toContain('Tuesday 08:00 (GMT)');

    const later = new Date('2027-03-29T00:00:00Z');
    const summer = finder(X, 'Europe/London', { now: later }).next(
      later,
      after(later, 2),
      '2027-03-30',
    );
    expect(summer?.at.toISOString()).toBe('2027-03-30T07:00:00.000Z');
    expect(summer?.reason).toContain('Tuesday 08:00 (BST)');
  });

  it('never suggests avoided times', () => {
    const allDay: PostingPolicy = {
      ...X,
      maxPerDay: 96,
      minSpacingMinutes: 0,
      windows: [{ days: ALL, start: '00:00', end: '24:00', weight: 1 }],
      avoid: [{ days: ALL, start: '12:00', end: '13:00', weight: 1 }],
    };
    const slots = finder(allDay, 'Africa/Lagos').spread(
      MONDAY,
      after(MONDAY, 1),
      96,
    );
    const hours = slots.map((s) => localTime(s.at, 'Africa/Lagos').minutes);
    // 00:15 to 23:45 UTC, less the four quarter hours of 12:00 in Lagos.
    expect(slots).toHaveLength(95 - 4);
    expect(hours.some((m) => m >= 720 && m < 780)).toBe(false);
    // Saturday is avoided entirely on X.
    const saturday = new Date('2026-12-05T00:00:00Z');
    expect(
      finder(X, 'Africa/Lagos', { now: saturday }).next(
        saturday,
        after(saturday, 1),
      ),
    ).toBeNull();
  });

  it('nudges by the jitter, forward when back would leave the window', () => {
    const early = finder(X, 'Africa/Kampala', { jitter: -2 }).next(
      MONDAY,
      after(MONDAY, 7),
      '2026-12-01',
    );
    expect(early?.at.toISOString()).toBe('2026-12-01T05:02:00.000Z');
    const late = finder(X, 'Africa/Kampala', { jitter: 3 }).next(
      MONDAY,
      after(MONDAY, 7),
      '2026-12-01',
    );
    expect(late?.at.toISOString()).toBe('2026-12-01T05:03:00.000Z');
  });

  it('keeps at least 10 minutes ahead of now', () => {
    const now = new Date('2026-12-01T05:05:00Z'); // Tue 08:05 EAT
    const slot = finder(X, 'Africa/Kampala', { now }).next(now, after(now, 1));
    expect(slot?.at.toISOString()).toBe('2026-12-01T05:15:00.000Z');
  });

  it('keeps its spacing from other posts and from its own slots', () => {
    const busy = [{ at: new Date('2026-12-01T05:00:00Z'), published: false }];
    const f = finder(X, 'Africa/Kampala', { busy });
    const first = f.next(MONDAY, after(MONDAY, 7), '2026-12-01');
    expect(first?.at.toISOString()).toBe('2026-12-01T07:00:00.000Z');
    const second = f.next(MONDAY, after(MONDAY, 7), '2026-12-01');
    // 08:00 and 10:00 are taken; the next window opens at 12:00.
    expect(second?.at.toISOString()).toBe('2026-12-01T09:00:00.000Z');
    expect(second?.reason).toContain('a fair time for X');
  });

  it('caps posts per audience-local day', () => {
    const policy = { ...X, maxPerDay: 1, minSpacingMinutes: 0 };
    // Tue 22:30 UTC is already Wednesday 01:30 in Kampala.
    const busy = [{ at: new Date('2026-12-01T22:30:00Z'), published: true }];
    const f = finder(policy, 'Africa/Kampala', { busy });
    expect(
      f.next(MONDAY, after(MONDAY, 7), '2026-12-01')?.at.toISOString(),
    ).toBe('2026-12-01T05:00:00.000Z');
    expect(
      f.next(MONDAY, after(MONDAY, 7), '2026-12-02')?.at.toISOString(),
    ).toBe('2026-12-03T05:00:00.000Z');
    expect(f.conflict(new Date('2026-12-02T09:00:00Z'))).toEqual({
      kind: 'per_day',
      day: '2026-12-02',
      count: 1,
    });
  });

  it('reports the nearest post that’s too close', () => {
    const busy = [
      { at: new Date('2026-12-01T05:00:00Z'), published: true },
      { at: new Date('2026-12-01T07:30:00Z'), published: false },
    ];
    const conflict = finder(X, 'Africa/Kampala', { busy }).conflict(
      new Date('2026-12-01T06:45:00Z'),
    );
    expect(conflict).toEqual({ kind: 'spacing', other: busy[1] });
    expect(
      finder(X, 'Africa/Kampala', { busy }).conflict(
        new Date('2026-12-01T09:30:00Z'),
      ),
    ).toBeNull();
  });

  it('spreads several posts across the strongest days', () => {
    const slots = finder(X, 'Africa/Kampala').spread(
      MONDAY,
      after(MONDAY, 7),
      3,
    );
    expect(slots.map((s) => s.at.toISOString())).toEqual([
      '2026-12-01T05:00:00.000Z',
      '2026-12-02T05:00:00.000Z',
      '2026-12-03T05:00:00.000Z',
    ]);
  });

  it('comes back for more days’ second slots only after every day has one', () => {
    const slots = finder(X, 'Africa/Kampala').spread(
      MONDAY,
      after(MONDAY, 2),
      4,
    );
    const days = slots.map((s) => localTime(s.at, 'Africa/Kampala').day);
    expect(days).toEqual([
      '2026-11-30',
      '2026-11-30',
      '2026-12-01',
      '2026-12-01',
    ]);
    const gaps = slots
      .slice(1)
      .map((s, i) => s.at.getTime() - slots[i].at.getTime());
    expect(gaps.every((g) => g >= 120 * 60_000)).toBe(true);
  });

  it('stops when the caps leave no room', () => {
    // One a day over Monday to Wednesday.
    const daily = { ...X, maxPerDay: 1, minSpacingMinutes: 24 * 60 };
    expect(
      finder(daily, 'Africa/Kampala').spread(MONDAY, after(MONDAY, 3), 10),
    ).toHaveLength(3);
  });
});

describe('hashJitter', () => {
  it('moves 1 to 3 minutes either way, the same every time', () => {
    const base = new Date('2026-12-01T05:00:00Z');
    const values = Array.from({ length: 50 }, (_, i) =>
      hashJitter(`acc-${i}`, base),
    );
    expect(values.every((v) => v !== 0 && Math.abs(v) <= 3)).toBe(true);
    expect(new Set(values).size).toBeGreaterThan(2);
    expect(hashJitter('acc-1', base)).toBe(hashJitter('acc-1', base));
  });
});

describe('time zone names', () => {
  it('names zones the way people there do', () => {
    const at = new Date('2026-12-03T08:15:00Z');
    expect(zoneName(at, 'Africa/Nairobi')).toBe('EAT');
    expect(zoneName(at, 'UTC')).toBe('UTC');
    expect(zoneName(new Date('2027-07-01T12:00:00Z'), 'Europe/London')).toBe(
      'BST',
    );
    expect(describeMoment(at, 'Africa/Kampala')).toBe('Thu 3 Dec, 11:15 EAT');
  });
});
