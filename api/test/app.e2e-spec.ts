import { PublishingService } from '../src/modules/publishing/publishing.service.js';
import {
  CID,
  createRecordBody,
  DID,
  HANDLE,
  sessionBody,
  tid,
} from './support/bluesky-fixtures.js';
import { mockFetch } from './support/mock-fetch.js';
import {
  BLUESKY_TOPICS,
  GOOGLE_TRENDS_UG_RSS,
  MASTODON_TAGS,
} from './support/trends-fixtures.js';
import {
  signUp,
  startTestApp,
  type SignedUp,
  type TestApp,
} from './support/test-app.js';

/**
 * The whole product flow inside one workspace, signed in as its owner:
 * connect → post → publish → feed → metrics → agent plan → schedule.
 * Platforms are stubbed and the language model is fake.
 */

const MASTODON_TOKEN = 'm'.repeat(40);
const BSKY = 'bsky.social/xrpc';

let t: TestApp;
let http: TestApp['http'];
let owner: SignedUp;
let publishDue: () => Promise<{ status: string; error?: string }[]>;

/** Requests inside the owner's workspace, signed in. */
const api = {
  get: (path: string) =>
    http.get(`/api/workspaces/${owner.workspaceId}${path}`).set(owner.auth),
  post: (path: string) =>
    http.post(`/api/workspaces/${owner.workspaceId}${path}`).set(owner.auth),
  patch: (path: string) =>
    http.patch(`/api/workspaces/${owner.workspaceId}${path}`).set(owner.auth),
  delete: (path: string) =>
    http.delete(`/api/workspaces/${owner.workspaceId}${path}`).set(owner.auth),
};

/**
 * Schedules a Mastodon post clear of the account's spacing, then makes it
 * due, as if its time had come.
 */
async function scheduleDue(body: string) {
  const post = await api
    .post('/posts')
    .send({
      body,
      scheduledAt: new Date(Date.now() + 2 * 3_600_000).toISOString(),
      targets: [{ accountId: mastodonId }],
    })
    .expect(201);
  await t.dataSource.query(
    `UPDATE post_targets SET "scheduledAt" = now() - interval '1 second' WHERE "postId" = $1`,
    [post.body.id],
  );
  return post;
}

let mastodonId: string;
let blueskyId: string;
let mastodonStatus = 200;
let mastodonCounter = 0;
let blueskyCounter = 0;
let mastodonMediaChecks = 0;

function stubPlatforms() {
  return mockFetch({
    'GET trends.google.com/trending/rss': () => ({ raw: GOOGLE_TRENDS_UG_RSS }),
    'GET mastodon.social/api/v1/trends/tags': () => ({ body: MASTODON_TAGS }),
    'GET public.api.bsky.app/xrpc/app.bsky.unspecced.getTrendingTopics':
      () => ({
        body: BLUESKY_TOPICS,
      }),
    'GET mastodon.social/api/v1/accounts/verify_credentials': () => ({
      body: {
        id: '42',
        username: 'yo',
        acct: 'yo',
        display_name: 'Aby Socials',
        url: 'https://mastodon.social/@yo',
        avatar: 'https://files/avatar.png',
      },
    }),
    'POST mastodon.social/api/v1/statuses': () => {
      if (mastodonStatus !== 200) {
        return {
          status: mastodonStatus,
          body: { error: `HTTP ${mastodonStatus}` },
          headers: {
            'x-ratelimit-reset': new Date(Date.now() + 600_000).toISOString(),
          },
        };
      }
      const id = String(1000 + ++mastodonCounter);
      return {
        body: {
          id,
          url: `https://mastodon.social/@yo/${id}`,
          created_at: new Date().toISOString(),
          favourites_count: 0,
          reblogs_count: 0,
          replies_count: 0,
        },
      };
    },
    'GET mastodon.social/api/v1/statuses/1001': () => ({
      body: {
        id: '1001',
        url: null,
        created_at: new Date().toISOString(),
        favourites_count: 7,
        reblogs_count: 3,
        replies_count: 2,
      },
    }),
    'GET abysocials.test/media/*': () => ({ raw: 'jpeg-bytes' }),
    'GET mastodon.social/api/v2/instance': () => ({
      body: { configuration: { statuses: { max_media_attachments: 4 } } },
    }),
    'POST mastodon.social/api/v2/media': () => ({
      status: 202,
      body: { id: '501', type: 'image', url: null },
    }),
    'GET mastodon.social/api/v1/media/501': () =>
      ++mastodonMediaChecks < 2
        ? { status: 206, body: { id: '501', type: 'image', url: null } }
        : { body: { id: '501', type: 'image', url: 'https://files/501.jpg' } },
    [`POST ${BSKY}/com.atproto.repo.uploadBlob`]: () => ({
      body: {
        blob: {
          $type: 'blob',
          ref: { $link: CID.replace('bafyrei', 'bafkrei') },
          mimeType: 'image/jpeg',
          size: 10,
        },
      },
    }),
    [`POST ${BSKY}/com.atproto.server.createSession`]: () => ({
      body: sessionBody(),
    }),
    [`POST ${BSKY}/com.atproto.server.refreshSession`]: () => ({
      body: sessionBody(),
    }),
    [`GET ${BSKY}/app.bsky.actor.getProfile`]: () => ({
      body: { did: DID, handle: HANDLE, displayName: 'Yo' },
    }),
    [`POST ${BSKY}/com.atproto.repo.createRecord`]: () => ({
      body: createRecordBody(tid(++blueskyCounter)),
    }),
    [`GET ${BSKY}/app.bsky.feed.getPosts`]: (req) => ({
      body: {
        posts: req.url.searchParams.getAll('uris').map((uri) => ({
          uri,
          cid: CID,
          author: { did: DID, handle: HANDLE },
          record: {},
          indexedAt: new Date().toISOString(),
          likeCount: 11,
          repostCount: 1,
          replyCount: 0,
          quoteCount: 1,
        })),
      },
    }),
  });
}

beforeAll(async () => {
  t = await startTestApp();
  http = t.http;
  owner = await signUp(http, 'Owner');
  const publishing = t.app.get(PublishingService);
  publishDue = () => publishing.publishDue();
}, 60_000);

beforeEach(() => {
  stubPlatforms();
  mastodonStatus = 200;
});

afterEach(() => vi.unstubAllGlobals());

afterAll(() => t?.close());

describe('Aby Socials API', () => {
  it('allows the deployed frontend origin through CORS', async () => {
    await http
      .options('/api/health')
      .set('Origin', 'https://abysocials.com')
      .set('Access-Control-Request-Method', 'POST')
      .expect(204)
      .expect('Access-Control-Allow-Origin', 'https://abysocials.com');
  });

  it('reports healthy with migrations applied', async () => {
    await http.get('/api/health').expect(200, { status: 'ok', database: 'up' });
    const tables: { table_name: string }[] = await t.dataSource.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1`,
    );
    expect(tables.map((t) => t.table_name)).toEqual(
      expect.arrayContaining([
        'post_metric_snapshots',
        'post_targets',
        'posts',
        'social_accounts',
        'users',
        'workspaces',
        'workspace_members',
        'auth_refresh_tokens',
      ]),
    );
  });

  it('lists the supported platforms', async () => {
    const res = await http.get('/api/integrations').expect(200);
    expect(
      res.body.map((p: { platform: string }) => p.platform).sort(),
    ).toEqual([
      'bluesky',
      'discord',
      'linkedin',
      'mastodon',
      'telegram',
      'tiktok',
      'x',
    ]);
  });

  it('connects accounts, never returning or storing plaintext credentials', async () => {
    const mastodon = await api
      .post('/accounts')
      .send({
        platform: 'mastodon',
        credentials: {
          instanceUrl: 'https://mastodon.social',
          accessToken: MASTODON_TOKEN,
        },
        persona: 'company',
        voice: 'Warm, concise, no jargon',
      })
      .expect(201);
    expect(mastodon.body).toMatchObject({
      platform: 'mastodon',
      handle: '@yo@mastodon.social',
      persona: 'company',
      status: 'active',
    });
    expect(JSON.stringify(mastodon.body)).not.toContain(MASTODON_TOKEN);
    mastodonId = mastodon.body.id;

    const bluesky = await api
      .post('/accounts')
      .send({
        platform: 'bluesky',
        credentials: {
          identifier: 'yo.bsky.social',
          appPassword: 'abcd-efgh-ijkl-mnop',
        },
      })
      .expect(201);
    blueskyId = bluesky.body.id;

    const [row]: { encryptedCredentials: string }[] = await t.dataSource.query(
      `SELECT "encryptedCredentials" FROM social_accounts WHERE id = $1`,
      [mastodonId],
    );
    expect(row.encryptedCredentials).toMatch(/^v1\./);
    expect(row.encryptedCredentials).not.toContain(MASTODON_TOKEN);
  });

  it('rejects credentials with unknown fields', async () => {
    const res = await api
      .post('/accounts')
      .send({
        platform: 'discord',
        credentials: { webhookUrl: 'https://evil.example/hook', extra: 1 },
      })
      .expect(400);
    expect(res.body.message).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Paste a Discord webhook URL'),
      ]),
    );
  });

  it('rejects text longer than a platform allows', async () => {
    const res = await api
      .post('/posts')
      .send({ body: 'x'.repeat(301), targets: [{ accountId: blueskyId }] })
      .expect(400);
    expect(res.body.message[0]).toContain(
      'Bluesky allows 300 characters; the text for yo.bsky.social has 301',
    );
  });

  it('publishes due posts exactly once, even with concurrent schedulers', async () => {
    const created = await api
      .post('/posts')
      .send({
        title: 'Launch',
        body: 'We are live! #launch',
        scheduledAt: new Date(Date.now() - 60_000).toISOString(),
        targets: [
          { accountId: mastodonId },
          { accountId: blueskyId, text: 'Live on Bluesky 🦋' },
        ],
      })
      .expect(201);
    expect(created.body.status).toBe('scheduled');

    const fetchMock = vi.mocked(fetch);
    fetchMock.mockClear();
    const [a, b] = await Promise.all([publishDue(), publishDue()]);
    expect([...a, ...b].map((o) => o.status)).toEqual([
      'published',
      'published',
    ]);

    const sends = fetchMock.mock.calls.filter(([url]) =>
      /statuses$|createRecord$/.test(new URL(url as string | URL).pathname),
    );
    expect(sends).toHaveLength(2);

    const post = await api.get(`/posts/${created.body.id}`).expect(200);
    expect(post.body.status).toBe('published');
  });

  it('shows published posts from every account in the unified feed', async () => {
    const res = await api.get('/feed').expect(200);
    expect(res.body.total).toBe(2);
    expect(
      res.body.items
        .map((i: { account: { platform: string } }) => i.account.platform)
        .sort(),
    ).toEqual(['bluesky', 'mastodon']);
    const bsky = res.body.items.find(
      (i: { account: { platform: string } }) =>
        i.account.platform === 'bluesky',
    );
    expect(bsky).toMatchObject({
      text: 'Live on Bluesky 🦋',
      customText: true,
      postTitle: 'Launch',
    });
    expect(bsky.externalUrl).toMatch(
      /^https:\/\/bsky\.app\/profile\/yo\.bsky\.social\/post\//,
    );

    const filtered = await api.get('/feed?platform=mastodon').expect(200);
    expect(filtered.body.total).toBe(1);
  });

  it('captures metrics and reports them in analytics', async () => {
    await api.post('/analytics/refresh').expect(200, { captured: 2 });
    // Second refresh inside the 30-minute window is a no-op.
    await api.post('/analytics/refresh').expect(200, { captured: 0 });

    const overview = await api.get('/analytics/overview?days=7').expect(200);
    expect(overview.body.totals).toEqual({
      posts: 2,
      likes: 18,
      reposts: 4,
      replies: 2,
      quotes: 1,
      views: 0,
      engagement: 25,
    });
    expect(overview.body.topPosts[0]).toMatchObject({
      platform: 'bluesky',
      engagement: 13,
    });

    const feed = await api.get('/feed?platform=mastodon').expect(200);
    const target = feed.body.items[0];
    expect(target.metrics).toMatchObject({ likes: 7, reposts: 3, replies: 2 });
    const history = await api
      .get(`/analytics/targets/${target.id}/history`)
      .expect(200);
    expect(history.body).toHaveLength(1);
  });

  it('retries transient failures with backoff and flags revoked tokens', async () => {
    const post = await scheduleDue('Retry me');
    const targetId: string = post.body.targets[0].id;

    mastodonStatus = 503;
    expect(await publishDue()).toEqual([
      { targetId, status: 'scheduled', error: 'HTTP 503' },
    ]);
    const [retry]: { scheduledAt: Date; attempts: number }[] =
      await t.dataSource.query(
        `SELECT "scheduledAt", attempts FROM post_targets WHERE id = $1`,
        [targetId],
      );
    expect(retry.attempts).toBe(1);
    expect(new Date(retry.scheduledAt).getTime()).toBeGreaterThan(Date.now());

    mastodonStatus = 401;
    const now = await api.post(`/posts/${post.body.id}/publish`).expect(200);
    expect(now.body).toEqual([
      { targetId, status: 'failed', error: 'HTTP 401' },
    ]);
    const account = await api.get(`/accounts/${mastodonId}`).expect(200);
    expect(account.body).toMatchObject({
      status: 'needs_reconnect',
      lastError: 'HTTP 401',
    });

    // Reconnecting clears the flag.
    await api
      .post('/accounts')
      .send({
        platform: 'mastodon',
        credentials: {
          instanceUrl: 'https://mastodon.social',
          accessToken: MASTODON_TOKEN,
        },
      })
      .expect(201);
    await api.delete(`/posts/${post.body.id}`).expect(204);
  });

  it('waits as long as a rate-limited platform asks before trying again', async () => {
    const post = await scheduleDue('Slow down');
    const targetId: string = post.body.targets[0].id;

    mastodonStatus = 429;
    expect(await publishDue()).toEqual([
      { targetId, status: 'scheduled', error: 'HTTP 429' },
    ]);
    const [retry]: { scheduledAt: Date; attempts: number }[] =
      await t.dataSource.query(
        `SELECT "scheduledAt", attempts FROM post_targets WHERE id = $1`,
        [targetId],
      );
    expect(retry.attempts).toBe(1);
    // Mastodon's reset is 10 minutes away, longer than our 2-minute backoff.
    const wait = new Date(retry.scheduledAt).getTime() - Date.now();
    expect(wait).toBeGreaterThan(9 * 60_000);
    expect(wait).toBeLessThanOrEqual(10 * 60_000);
    await api.delete(`/posts/${post.body.id}`).expect(204);
  });

  it('sets the workspace’s audience country and time zone', async () => {
    const bad = await api
      .patch('')
      .send({ audienceTimeZone: 'Mars/Olympus', audienceCountry: 'XX' })
      .expect(400);
    expect(bad.body.message).toEqual(
      expect.arrayContaining([
        'Choose your audience’s country from the list',
        'Choose your audience’s time zone from the list',
      ]),
    );

    const res = await api
      .patch('')
      .send({ audienceCountry: 'ug', audienceTimeZone: 'Africa/Kampala' })
      .expect(200);
    expect(res.body).toMatchObject({
      audienceCountry: 'UG',
      audienceTimeZone: 'Africa/Kampala',
    });
    const workspace = await api.get('').expect(200);
    expect(workspace.body.name).toBe(res.body.name);
    expect(workspace.body.audienceTimeZone).toBe('Africa/Kampala');
  });

  it('suggests free times from each platform’s windows, with reasons', async () => {
    const res = await api
      .post('/schedule/suggestions')
      .send({ accountIds: [mastodonId, blueskyId], days: 3, count: 2 })
      .expect(200);
    expect(res.body.timeZone).toBe('Africa/Kampala');
    expect(res.body.suggestions).toHaveLength(4);
    for (const s of res.body.suggestions) {
      expect(new Date(s.at).getTime()).toBeGreaterThan(Date.now() + 9 * 60_000);
      expect(s.reason).toMatch(/^\w+day \d{2}:\d{2} \(EAT\) is .+ Source: /);
    }
    const mastodon = res.body.suggestions.filter(
      (s: { platform: string }) => s.platform === 'mastodon',
    );
    expect(mastodon).toHaveLength(2);
    // Spread over different days rather than stacked on one.
    const day = (s: { at: string }) =>
      new Date(new Date(s.at).getTime() + 3 * 3_600_000)
        .toISOString()
        .slice(0, 10);
    expect(day(mastodon[0])).not.toBe(day(mastodon[1]));

    const lagos = await api
      .post('/schedule/suggestions')
      .send({ accountIds: [blueskyId], count: 1, timeZone: 'Africa/Lagos' })
      .expect(200);
    expect(lagos.body.timeZone).toBe('Africa/Lagos');
    expect(lagos.body.suggestions[0].reason).toContain('(WAT)');

    const tooMany = await api
      .post('/schedule/suggestions')
      .send({ accountIds: [mastodonId], count: 11 })
      .expect(400);
    expect(tooMany.body.message).toEqual([
      'Ask for between 1 and 10 times per account',
    ]);
  });

  it('says whether the AI can search the web', async () => {
    const res = await api.get('/agent/capabilities').expect(200);
    expect(res.body).toEqual({ model: 'fake-model', searchWeb: false });
  });

  it('turns an agent plan into drafts, dropping suggestions that break rules', async () => {
    const start = new Date(Date.now() + 86_400_000);
    // The workspace audience is in Kampala (UTC+3).
    const kampalaDay = (d: Date) =>
      new Date(d.getTime() + 3 * 3_600_000).toISOString().slice(0, 10);
    const day = kampalaDay(start);
    const late = kampalaDay(new Date(start.getTime() + 30 * 86_400_000));
    t.model.generateJson.mockResolvedValueOnce({
      posts: [
        {
          title: 'Teaser',
          idea: 'Something big is coming',
          targets: [
            {
              accountId: mastodonId,
              text: 'Something big is coming Monday.',
              date: day,
            },
            { accountId: blueskyId, text: 'b'.repeat(400), date: day },
          ],
        },
        {
          title: 'Out of window',
          idea: 'Too late',
          targets: [{ accountId: mastodonId, text: 'Late', date: late }],
        },
      ],
    });

    const plan = await api
      .post('/agent/plan')
      .send({
        brief: 'Tease our launch next week to existing followers.',
        accountIds: [mastodonId, blueskyId],
        startDate: start.toISOString(),
        days: 7,
      })
      .expect(200);

    expect(plan.body.model).toBe('fake-model');
    expect(plan.body.timeZone).toBe('Africa/Kampala');
    expect(plan.body.posts).toHaveLength(1);
    expect(plan.body.posts[0]).toMatchObject({
      source: 'agent',
      status: 'draft',
      title: 'Teaser',
    });
    expect(plan.body.posts[0].targets).toHaveLength(1);
    expect(plan.body.skipped).toHaveLength(2);
    expect(plan.body.skipped.join('\n')).toMatch(
      /allows 300 characters[\s\S]*outside the dates/,
    );

    // The engine, not the model, chose the time: inside Mastodon's waking hours.
    const [target] = plan.body.posts[0].targets;
    const at = new Date(target.scheduledAt);
    expect(kampalaDay(at) >= day).toBe(true);
    const hour = (at.getUTCHours() + 3) % 24;
    expect(hour).toBeGreaterThanOrEqual(8);
    expect(hour).toBeLessThan(21);
    expect(target.scheduleReason).toMatch(
      /^\w+day \d{2}:\d{2} \(EAT\) is a good time for Mastodon\. Source: Waking hours/,
    );

    const prompt = t.model.generateJson.mock.calls[0][0].prompt as string;
    expect(prompt).toContain('Warm, concise, no jargon');
    expect(prompt).toContain('Audience time zone: Africa/Kampala');
    expect(prompt).toContain('Audience country: Uganda (UG)');
    expect(prompt).toContain(
      'posting limit: at most 3 post(s) a day, at least 90 minutes apart',
    );
    expect(prompt).not.toContain('scheduledAt');
    // What's trending for the audience country goes to the AI and back to the person.
    expect(prompt).toContain("What's trending now:");
    expect(prompt).toContain('mauricio pochettino');
    expect(plan.body.trends).toMatchObject({ country: 'UG' });
    expect(plan.body.grounding).toBeNull();

    const postId: string = plan.body.posts[0].id;
    const scheduled = await api
      .post(`/posts/${postId}/schedule`)
      .send({})
      .expect(200);
    expect(scheduled.body.status).toBe('scheduled');
    expect(scheduled.body.targets[0].scheduleReason).toBe(
      target.scheduleReason,
    );

    const calendar = await api
      .get('/calendar')
      .query({
        from: start.toISOString(),
        to: new Date(start.getTime() + 7 * 86_400_000).toISOString(),
      })
      .expect(200);
    expect(calendar.body.map((i: { postId: string }) => i.postId)).toContain(
      postId,
    );

    // Too close to it: refused, with the platform's rule and the next free time.
    const clash = await api
      .post('/posts')
      .send({
        body: 'Right after',
        scheduledAt: new Date(at.getTime() + 30 * 60_000).toISOString(),
        targets: [{ accountId: mastodonId }],
      })
      .expect(400);
    expect(clash.body.message).toEqual([
      expect.stringMatching(
        /^Mastodon posts from Aby Socials are kept at least 90 minutes apart, and another is scheduled at \w{3} \d{1,2} \w{3}, \d{2}:\d{2} EAT\. The next free time is \w{3} \d{1,2} \w{3}, \d{2}:\d{2} EAT\.$/,
      ),
    ]);

    // Moving it by hand clears the engine's reason; the guard still applies.
    const moved = new Date(at.getTime() + 3 * 3_600_000);
    const patched = await api
      .patch(`/posts/${postId}/targets/${target.id}`)
      .send({ scheduledAt: moved.toISOString() })
      .expect(200);
    expect(patched.body.targets[0]).toMatchObject({
      scheduledAt: moved.toISOString(),
      scheduleReason: null,
    });
    await api.post(`/posts/${postId}/unschedule`).expect(200);
  });

  it('gives each account no more posts a day than its platform’s cap', async () => {
    // One whole day in Kampala, three days from now.
    const day = new Date(Date.now() + 3 * 86_400_000 + 3 * 3_600_000)
      .toISOString()
      .slice(0, 10);
    const start = new Date(`${day}T00:00:00+03:00`);
    t.model.generateJson.mockResolvedValueOnce({
      posts: [1, 2, 3, 4].map((n) => ({
        title: `Idea ${n}`,
        idea: `Idea number ${n}`,
        targets: [{ accountId: mastodonId, text: `Post ${n}`, date: day }],
      })),
    });
    const plan = await api
      .post('/agent/plan')
      .send({
        brief: 'Four ideas for one day, please.',
        accountIds: [mastodonId],
        startDate: start.toISOString(),
        days: 1,
        timezone: 'Africa/Kampala',
      })
      .expect(200);
    expect(plan.body.posts).toHaveLength(3);
    const times = plan.body.posts
      .map((p: { targets: { scheduledAt: string }[] }) =>
        new Date(p.targets[0].scheduledAt).getTime(),
      )
      .sort();
    expect(times[1] - times[0]).toBeGreaterThanOrEqual(90 * 60_000);
    expect(times[2] - times[1]).toBeGreaterThanOrEqual(90 * 60_000);
    expect(plan.body.skipped).toEqual([
      expect.stringMatching(
        /^“Idea 4” for Mastodon: there’s no free time from \w{3} \d{1,2} \w{3} to the end of the plan\. We post to Mastodon up to 3 a day, at least 90 minutes apart\.$/,
      ),
    ]);

    // Approving all three fills the day, so a fourth that evening is refused.
    for (const p of plan.body.posts) {
      await api.post(`/posts/${p.id}/schedule`).send({}).expect(200);
    }
    const evening = await api
      .post('/posts')
      .send({ body: 'A fourth', targets: [{ accountId: mastodonId }] })
      .expect(201);
    // Drafts aren't checked: only approving it is.
    await api
      .patch(`/posts/${evening.body.id}/targets/${evening.body.targets[0].id}`)
      .send({ scheduledAt: `${day}T20:00:00+03:00` })
      .expect(200);
    const refused = await api
      .post(`/posts/${evening.body.id}/schedule`)
      .send({})
      .expect(400);
    expect(refused.body.message).toEqual([
      expect.stringMatching(
        /^Mastodon posts from Aby Socials are kept to 3 a day, and \w{3} \d{1,2} \w{3} already has 3\. The next free time is \w{3} \d{1,2} \w{3}, \d{2}:\d{2} EAT\.$/,
      ),
    ]);
    for (const p of [...plan.body.posts, evening.body]) {
      await api.delete(`/posts/${p.id}`).expect(204);
    }
  });

  it('never plans into the past, even when the window starts today', async () => {
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const yesterday = new Date(Date.now() - 2 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    t.model.generateJson.mockResolvedValueOnce({
      posts: [
        {
          title: 'Too early',
          idea: 'x',
          targets: [
            { accountId: mastodonId, text: 'Morning post', date: yesterday },
          ],
        },
      ],
    });
    const plan = await api
      .post('/agent/plan')
      .send({
        brief: 'Anything at all here',
        accountIds: [mastodonId],
        startDate: midnight.toISOString(),
        days: 1,
      })
      .expect(200);
    expect(plan.body.posts).toHaveLength(0);
    expect(plan.body.skipped[0]).toMatch(/outside the dates/);
    expect(t.model.generateJson.mock.lastCall?.[0].system).toMatch(
      /Never make up a link/,
    );
  });

  it('publishes a photo to Mastodon and Bluesky, waiting for Mastodon to process it', async () => {
    const reserved = await api
      .post('/media/uploads')
      .send({ files: [{ contentType: 'image/jpeg', size: 10 }] })
      .expect(201);
    const [path] = reserved.body.customIds as string[];
    const post = await api
      .post('/posts')
      .send({
        body: 'Our new shop front',
        media: [
          {
            path,
            contentType: 'image/jpeg',
            size: 10,
            width: 1600,
            height: 900,
          },
        ],
        targets: [{ accountId: mastodonId }, { accountId: blueskyId }],
      })
      .expect(201);

    const { calls } = stubPlatforms();
    const outcomes = await api
      .post(`/posts/${post.body.id}/publish`)
      .expect(200);
    expect(outcomes.body.map((o: { status: string }) => o.status)).toEqual([
      'published',
      'published',
    ]);

    expect(calls.filter((c) => c.url.host === 'abysocials.test')).toHaveLength(
      2,
    );
    expect(mastodonMediaChecks).toBe(2);
    const status = calls.find((c) => c.url.pathname === '/api/v1/statuses')!;
    expect(status.body).toMatchObject({
      status: 'Our new shop front',
      media_ids: ['501'],
    });
    const record = calls.find((c) =>
      c.url.pathname.endsWith('com.atproto.repo.createRecord'),
    )!;
    expect(
      (record.body as { record: { embed: unknown } }).record.embed,
    ).toMatchObject({
      $type: 'app.bsky.embed.images',
      images: [{ aspectRatio: { width: 1600, height: 900 } }],
    });
  });

  it('rejects malformed model output instead of saving it', async () => {
    t.model.generateJson.mockResolvedValueOnce({
      posts: [{ title: 'No targets' }],
    });
    await api
      .post('/agent/plan')
      .send({
        brief: 'Anything at all here',
        accountIds: [mastodonId],
        startDate: new Date().toISOString(),
      })
      .expect(502);
  });
});
