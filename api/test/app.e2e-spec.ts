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

let mastodonId: string;
let blueskyId: string;
let mastodonStatus = 200;
let mastodonCounter = 0;
let blueskyCounter = 0;

function stubPlatforms() {
  return mockFetch({
    'GET mastodon.social/api/v1/accounts/verify_credentials': () => ({
      body: {
        id: '42',
        username: 'yo',
        acct: 'yo',
        display_name: 'Yo Socials',
        url: 'https://mastodon.social/@yo',
        avatar: 'https://files/avatar.png',
      },
    }),
    'POST mastodon.social/api/v1/statuses': () => {
      if (mastodonStatus !== 200) {
        return {
          status: mastodonStatus,
          body: { error: `HTTP ${mastodonStatus}` },
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

describe('Yo Socials API', () => {
  it('allows the deployed frontend origin through CORS', async () => {
    await http
      .options('/api/health')
      .set('Origin', 'https://yosocials.vercel.app')
      .set('Access-Control-Request-Method', 'POST')
      .expect(204)
      .expect(
        'Access-Control-Allow-Origin',
        'https://yosocials.vercel.app',
      );
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
    ).toEqual(['bluesky', 'discord', 'mastodon', 'telegram']);
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
        expect.stringContaining('webhookUrl must be a Discord webhook URL'),
      ]),
    );
  });

  it('rejects text longer than a platform allows', async () => {
    const res = await api
      .post('/posts')
      .send({ body: 'x'.repeat(301), targets: [{ accountId: blueskyId }] })
      .expect(400);
    expect(res.body.message[0]).toContain(
      'Bluesky (yo.bsky.social) allows 300 graphemes',
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
    const post = await api
      .post('/posts')
      .send({
        body: 'Retry me',
        scheduledAt: new Date(Date.now() - 1000).toISOString(),
        targets: [{ accountId: mastodonId }],
      })
      .expect(201);
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

  it('turns an agent plan into drafts, dropping suggestions that break rules', async () => {
    const start = new Date(Date.now() + 86_400_000);
    const at = (h: number) =>
      new Date(start.getTime() + h * 3_600_000).toISOString();
    t.model.generateJson.mockResolvedValueOnce({
      posts: [
        {
          title: 'Teaser',
          idea: 'Something big is coming',
          targets: [
            {
              accountId: mastodonId,
              text: 'Something big is coming Monday.',
              scheduledAt: at(10),
            },
            {
              accountId: blueskyId,
              text: 'b'.repeat(400),
              scheduledAt: at(11),
            },
          ],
        },
        {
          title: 'Out of window',
          idea: 'Too late',
          targets: [
            { accountId: mastodonId, text: 'Late', scheduledAt: at(24 * 30) },
          ],
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
        timezone: 'Africa/Kampala',
      })
      .expect(200);

    expect(plan.body.model).toBe('fake-model');
    expect(plan.body.posts).toHaveLength(1);
    expect(plan.body.posts[0]).toMatchObject({
      source: 'agent',
      status: 'draft',
      title: 'Teaser',
    });
    expect(plan.body.posts[0].targets).toHaveLength(1);
    expect(plan.body.skipped).toHaveLength(2);
    expect(plan.body.skipped.join('\n')).toMatch(
      /allows 300 graphemes[\s\S]*outside the window/,
    );

    const prompt = t.model.generateJson.mock.calls[0][0].prompt as string;
    expect(prompt).toContain('Warm, concise, no jargon');
    expect(prompt).toContain('Africa/Kampala');

    const postId: string = plan.body.posts[0].id;
    const scheduled = await api
      .post(`/posts/${postId}/schedule`)
      .send({})
      .expect(200);
    expect(scheduled.body.status).toBe('scheduled');

    const calendar = await api
      .get('/calendar')
      .query({ from: start.toISOString(), to: at(24 * 7) })
      .expect(200);
    expect(calendar.body.map((i: { postId: string }) => i.postId)).toContain(
      postId,
    );
  });

  it('never plans into the past, even when the window starts today', async () => {
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    t.model.generateJson.mockResolvedValueOnce({
      posts: [
        {
          title: 'Too early',
          idea: 'x',
          targets: [
            {
              accountId: mastodonId,
              text: 'Morning post',
              scheduledAt: new Date(Date.now() - 60_000).toISOString(),
            },
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
    expect(plan.body.skipped[0]).toMatch(/outside the window/);
    expect(t.model.generateJson.mock.lastCall?.[0].system).toMatch(
      /Never make up a link/,
    );
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
