import { mockFetch, type RecordedRequest } from './support/mock-fetch.js';
import {
  signUp,
  startTestApp,
  type SignedUp,
  type TestApp,
} from './support/test-app.js';
import {
  GOOGLE_TRENDS_UG_RSS,
  MASTODON_TAGS,
} from './support/trends-fixtures.js';

/** GET /trends end to end, with Google Trends, Mastodon and Bluesky stubbed. */

let t: TestApp;
let owner: SignedUp;
let calls: RecordedRequest[];

const trends = (country?: string, who: SignedUp = owner) =>
  t.http
    .get(`/api/workspaces/${owner.workspaceId}/trends`)
    .query(country === undefined ? {} : { country })
    .set(who.auth);

beforeAll(async () => {
  t = await startTestApp();
  owner = await signUp(t.http);
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await t.close();
});

beforeEach(() => {
  ({ calls } = mockFetch({
    'GET trends.google.com/trending/rss': (req) =>
      req.url.searchParams.get('geo') === 'RW'
        ? { status: 400, raw: '<html>Bad Request</html>' }
        : { raw: GOOGLE_TRENDS_UG_RSS },
    'GET mastodon.social/api/v1/trends/tags': () => ({ body: MASTODON_TAGS }),
    'GET public.api.bsky.app/xrpc/app.bsky.unspecced.getTrendingTopics':
      () => ({ status: 502, raw: 'Bad Gateway' }),
  }));
});

describe('GET /workspaces/:id/trends', () => {
  it('returns the country’s trends with platform-wide ones, and notes what’s missing', async () => {
    const res = await trends('ug').expect(200);

    expect(res.body).toMatchObject({
      country: 'UG',
      notes: [
        'We couldn’t get trending topics from Bluesky, so they’re left out for now.',
      ],
    });
    expect(res.body.items).toHaveLength(4);
    expect(res.body.items[0]).toMatchObject({
      source: 'google_trends',
      scope: 'country',
      term: 'mauricio pochettino',
      traffic: '500+',
    });
    expect(res.body.items[2]).toMatchObject({
      source: 'mastodon',
      scope: 'global',
      term: '#BooksForTurtles',
    });
  });

  it('serves repeat requests from the cache', async () => {
    await trends('GH').expect(200);
    const before = calls.length;
    await trends('GH').expect(200);
    expect(calls.length).toBe(before);
  });

  it('explains when Google Trends has no list for the country', async () => {
    const res = await trends('RW').expect(200);
    expect(res.body.notes).toContain(
      'Google Trends doesn’t publish a daily list for Rwanda, so this uses platform-wide trends only.',
    );
    expect(
      res.body.items.every((i: { scope: string }) => i.scope === 'global'),
    ).toBe(true);
  });

  it('uses the workspace’s audience country, or asks for one', async () => {
    const res = await trends(undefined).expect(400);
    expect(res.body.message).toMatch(
      /audience’s country in workspace settings/,
    );

    await t.http
      .patch(`/api/workspaces/${owner.workspaceId}`)
      .set(owner.auth)
      .send({ audienceCountry: 'KE' })
      .expect(200);
    expect((await trends(undefined).expect(200)).body.country).toBe('KE');
  });

  it.each(['XX', 'Uganda', ''])(
    'asks for a 2-letter country code (%s)',
    async (country) => {
      const res = await trends(country).expect(400);
      expect(res.body.message).toEqual([
        'Choose a country using its 2-letter code, like UG or KE',
      ]);
    },
  );

  it('is only for workspace members', async () => {
    const stranger = await signUp(t.http);
    await trends('UG', stranger).expect(404);
  });
});
