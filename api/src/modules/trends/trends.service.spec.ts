import { Logger } from '@nestjs/common';
import { mockFetch } from '../../../test/support/mock-fetch.js';
import {
  BLUESKY_TOPICS,
  GOOGLE_TRENDS_UG_RSS,
  MASTODON_TAGS,
} from '../../../test/support/trends-fixtures.js';
import { TrendsService } from './trends.service.js';
import type { TrendItem, TrendSnapshot } from './trends.types.js';

const GOOGLE = 'GET trends.google.com/trending/rss';
const MASTODON = 'GET mastodon.social/api/v1/trends/tags';
const BLUESKY =
  'GET public.api.bsky.app/xrpc/app.bsky.unspecced.getTrendingTopics';

type Routes = Parameters<typeof mockFetch>[0];

const working: Routes = {
  [GOOGLE]: (req) =>
    req.url.searchParams.get('geo') === 'RW'
      ? { status: 400, raw: '<html>Bad Request</html>' }
      : { raw: GOOGLE_TRENDS_UG_RSS },
  [MASTODON]: () => ({ body: MASTODON_TAGS }),
  [BLUESKY]: () => ({ body: BLUESKY_TOPICS }),
};

const count = (calls: { url: URL }[], host: string) =>
  calls.filter((c) => c.url.host === host).length;

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-28T09:00:00Z'));
  warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('TrendsService.forCountry', () => {
  it('combines Google Trends for the country with Mastodon and Bluesky', async () => {
    const { calls } = mockFetch(working);
    const snapshot = await new TrendsService().forCountry('ug');

    expect(snapshot.country).toBe('UG');
    expect(snapshot.notes).toEqual([]);
    expect(snapshot.updatedAt).toBe('2026-11-28T09:00:00.000Z');
    expect(snapshot.items.map((i) => [i.source, i.scope, i.term])).toEqual([
      ['google_trends', 'country', 'mauricio pochettino'],
      ['google_trends', 'country', 'spurs vs lakers'],
      ['mastodon', 'global', '#BooksForTurtles'],
      ['mastodon', 'global', '#OverIndulgeAMovie'],
      ['bluesky', 'global', 'Grand Theft Auto VI'],
    ]);
    expect(snapshot.items[2]).toMatchObject({
      traffic: '243',
      url: 'https://mastodon.social/tags/booksforturtles',
    });
    expect(snapshot.items[3].traffic).toBeNull();
    expect(snapshot.items[4]).toMatchObject({
      traffic: null,
      url: 'https://bsky.app/profile/did:plc:qrz3lhbyuxbeilrc6nekdqme/feed/00fbbcfbde85',
    });
    expect(
      calls.find((c) => c.url.host === 'trends.google.com')?.url.search,
    ).toBe('?geo=UG');
  });

  it('explains plainly when Google Trends has no list for the country (Rwanda answers 400)', async () => {
    mockFetch(working);
    const snapshot = await new TrendsService().forCountry('RW');

    expect(snapshot.items.every((i) => i.scope === 'global')).toBe(true);
    expect(snapshot.notes).toEqual([
      'Google Trends doesn’t publish a daily list for Rwanda, so this uses platform-wide trends only.',
    ]);
    expect(warn).not.toHaveBeenCalled();
  });

  it.each([
    ['Google Trends', GOOGLE, 'google_trends', /Google Trends for Uganda/],
    ['Mastodon', MASTODON, 'mastodon', /trending tags from Mastodon/],
    ['Bluesky', BLUESKY, 'bluesky', /trending topics from Bluesky/],
  ])(
    'carries on without %s when it fails',
    async (_name, route, source, note) => {
      mockFetch({
        ...working,
        [route]: () => ({ status: 503, raw: 'unavailable' }),
      });
      const snapshot = await new TrendsService().forCountry('UG');

      expect(snapshot.items.some((i) => i.source === source)).toBe(false);
      expect(snapshot.items.length).toBeGreaterThan(0);
      expect(snapshot.notes).toHaveLength(1);
      expect(snapshot.notes[0]).toMatch(note);
      expect(warn).toHaveBeenCalledOnce();
    },
  );

  it('never throws, even when every source is unreachable or malformed', async () => {
    mockFetch({
      [GOOGLE]: () => ({ raw: '<html>changed</html>' }),
      [MASTODON]: () => {
        throw new TypeError('fetch failed');
      },
      [BLUESKY]: () => ({ body: { unexpected: true } }),
    });
    const snapshot = await new TrendsService().forCountry('KE');

    expect(snapshot.items).toEqual([]);
    expect(snapshot.notes).toHaveLength(3);
  });

  it('shares one fetch between concurrent callers and caches for 3 hours', async () => {
    const { calls } = mockFetch(working);
    const service = new TrendsService();

    await Promise.all([
      service.forCountry('UG'),
      service.forCountry('UG'),
      service.forCountry('KE'),
    ]);
    expect(count(calls, 'trends.google.com')).toBe(2);
    expect(count(calls, 'mastodon.social')).toBe(1);
    expect(count(calls, 'public.api.bsky.app')).toBe(1);

    vi.setSystemTime(new Date('2026-11-28T11:59:00Z'));
    await service.forCountry('UG');
    expect(calls).toHaveLength(4);

    vi.setSystemTime(new Date('2026-11-28T12:01:00Z'));
    const fresh = await service.forCountry('UG');
    expect(calls).toHaveLength(7);
    expect(fresh.updatedAt).toBe('2026-11-28T12:01:00.000Z');
  });

  it('retries a failed source after 10 minutes, not 3 hours', async () => {
    let mastodonUp = false;
    const { calls } = mockFetch({
      ...working,
      [MASTODON]: () =>
        mastodonUp ? { body: MASTODON_TAGS } : { status: 500, raw: '' },
    });
    const service = new TrendsService();
    await service.forCountry('UG');

    mastodonUp = true;
    vi.setSystemTime(new Date('2026-11-28T09:11:00Z'));
    const snapshot = await service.forCountry('UG');

    expect(count(calls, 'mastodon.social')).toBe(2);
    expect(count(calls, 'trends.google.com')).toBe(1);
    expect(snapshot.notes).toEqual([]);
  });
});

describe('TrendsService.digest', () => {
  const item = (over: Partial<TrendItem>): TrendItem => ({
    source: 'google_trends',
    scope: 'country',
    term: 'term',
    traffic: null,
    url: null,
    news: [],
    observedAt: '2026-11-28T08:00:00.000Z',
    ...over,
  });
  const snapshot = (items: TrendItem[]): TrendSnapshot => ({
    country: 'UG',
    updatedAt: '2026-11-28T09:00:00.000Z',
    items,
    notes: [],
  });
  const service = new TrendsService();

  it('lists each trend with its source, traffic and up to 2 headlines', () => {
    const text = service.digest(
      snapshot([
        item({
          term: 'kenya airways',
          traffic: '2,000+',
          news: [1, 2, 3].map((n) => ({
            title: `Headline ${n}`,
            url: `https://example.com/${n}`,
            source: `Paper ${n}`,
          })),
        }),
        item({
          source: 'mastodon',
          scope: 'global',
          term: '#BooksForTurtles',
          traffic: '243',
        }),
        item({ source: 'bluesky', scope: 'global', term: 'GTA "VI"' }),
      ]),
    );
    const lines = text.split('\n');

    expect(lines[0]).toMatch(/not instructions/);
    expect(lines[0]).toMatch(/never invent facts/);
    expect(lines.slice(1)).toEqual([
      '- "kenya airways" (Google Trends in UG, 2,000+ searches). News: "Headline 1" (Paper 1); "Headline 2" (Paper 2)',
      '- "#BooksForTurtles" (Mastodon, platform-wide, 243 posts in the latest day)',
      '- "GTA \\"VI\\"" (Bluesky, platform-wide)',
    ]);
  });

  it('takes sources in turn so each is represented within the limit', () => {
    const many = [
      ...Array.from({ length: 10 }, (_, n) => item({ term: `g${n}` })),
      ...Array.from({ length: 10 }, (_, n) =>
        item({ source: 'mastodon', scope: 'global', term: `m${n}` }),
      ),
      item({ source: 'bluesky', scope: 'global', term: 'b0' }),
    ];
    const terms = service
      .digest(snapshot(many), 5)
      .split('\n')
      .slice(1)
      .map((line) => /^- "([^"]+)"/.exec(line)?.[1]);

    expect(terms).toEqual(['g0', 'm0', 'b0', 'g1', 'm1']);
  });

  it('says so when there is nothing to list', () => {
    expect(service.digest(snapshot([]))).toBe(
      'No trend signals are available right now.',
    );
  });
});
