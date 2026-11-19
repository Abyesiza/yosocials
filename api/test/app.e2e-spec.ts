import { randomBytes } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import type { LanguageModel } from '../src/modules/agent/interfaces/language-model.interface.js';
import { mockFetch } from './support/mock-fetch.js';

/**
 * Boots the real app against an in-memory Postgres (PGlite) with migrations,
 * a fake language model, and stubbed platform APIs, then walks the whole
 * flow: connect → post → publish → feed → metrics → agent plan → schedule.
 */

const PORT = 20_000 + Math.floor(Math.random() * 20_000);
const MASTODON_TOKEN = 'm'.repeat(40);
const BSKY = 'bsky.social/xrpc';

let app: INestApplication<App>;
let http: ReturnType<typeof request>;
let db: PGlite;
let server: PGLiteSocketServer;
let dataSource: DataSource;
let publishDue: () => Promise<{ status: string; error?: string }[]>;
const model = {
  modelName: 'fake-model',
  generateJson: vi.fn(),
} satisfies LanguageModel;

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
      body: {
        did: 'did:plc:yo',
        handle: 'yo.bsky.social',
        accessJwt: 'jwt',
        refreshJwt: 'r',
      },
    }),
    'GET public.api.bsky.app/xrpc/app.bsky.actor.getProfile': () => ({
      body: { did: 'did:plc:yo', handle: 'yo.bsky.social', displayName: 'Yo' },
    }),
    [`POST ${BSKY}/com.atproto.repo.createRecord`]: () => ({
      body: {
        uri: `at://did:plc:yo/app.bsky.feed.post/${++blueskyCounter}`,
        cid: 'c',
      },
    }),
    'GET public.api.bsky.app/xrpc/app.bsky.feed.getPosts': (req) => ({
      body: {
        posts: req.url.searchParams
          .getAll('uris')
          .map((uri) => ({
            uri,
            cid: 'c',
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
  db = await PGlite.create();
  server = new PGLiteSocketServer({
    db,
    port: PORT,
    host: '127.0.0.1',
    maxConnections: 20,
  });
  await server.start();

  Object.assign(process.env, {
    NODE_ENV: 'test',
    DATABASE_URL: `postgres://postgres:postgres@127.0.0.1:${PORT}/postgres`,
    CREDENTIALS_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
    SCHEDULER_ENABLED: 'false',
  });

  // Imported after env is set: ConfigModule validates env at import time.
  const { AppModule } = await import('../src/app.module.js');
  const { configureApp } = await import('../src/app.setup.js');
  const { LANGUAGE_MODEL } =
    await import('../src/modules/agent/interfaces/language-model.interface.js');
  const { PublishingService } =
    await import('../src/modules/publishing/publishing.service.js');

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(LANGUAGE_MODEL)
    .useValue(model)
    .compile();

  app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  http = request(app.getHttpServer());
  dataSource = app.get(DataSource);
  const publishing = app.get(PublishingService);
  publishDue = () => publishing.publishDue();
}, 60_000);

beforeEach(() => {
  stubPlatforms();
  mastodonStatus = 200;
});

afterEach(() => vi.unstubAllGlobals());

afterAll(async () => {
  await app?.close();
  await server?.stop();
  await db?.close();
});

describe('Yo Socials API', () => {
  it('reports healthy with migrations applied', async () => {
    await http.get('/api/health').expect(200, { status: 'ok', database: 'up' });
    const tables: { table_name: string }[] = await dataSource.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1`,
    );
    expect(tables.map((t) => t.table_name)).toEqual(
      expect.arrayContaining([
        'post_metric_snapshots',
        'post_targets',
        'posts',
        'social_accounts',
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
    const mastodon = await http
      .post('/api/accounts')
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

    const bluesky = await http
      .post('/api/accounts')
      .send({
        platform: 'bluesky',
        credentials: {
          identifier: 'yo.bsky.social',
          appPassword: 'abcd-efgh-ijkl-mnop',
        },
      })
      .expect(201);
    blueskyId = bluesky.body.id;

    const [row]: { encryptedCredentials: string }[] = await dataSource.query(
      `SELECT "encryptedCredentials" FROM social_accounts WHERE id = $1`,
      [mastodonId],
    );
    expect(row.encryptedCredentials).toMatch(/^v1\./);
    expect(row.encryptedCredentials).not.toContain(MASTODON_TOKEN);
  });

  it('rejects credentials with unknown fields', async () => {
    const res = await http
      .post('/api/accounts')
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
    const res = await http
      .post('/api/posts')
      .send({ body: 'x'.repeat(301), targets: [{ accountId: blueskyId }] })
      .expect(400);
    expect(res.body.message[0]).toContain(
      'Bluesky (yo.bsky.social) allows 300 graphemes',
    );
  });

  it('publishes due posts exactly once, even with concurrent schedulers', async () => {
    const created = await http
      .post('/api/posts')
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

    const post = await http.get(`/api/posts/${created.body.id}`).expect(200);
    expect(post.body.status).toBe('published');
  });

  it('shows published posts from every account in the unified feed', async () => {
    const res = await http.get('/api/feed').expect(200);
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

    const filtered = await http.get('/api/feed?platform=mastodon').expect(200);
    expect(filtered.body.total).toBe(1);
  });

  it('captures metrics and reports them in analytics', async () => {
    await http.post('/api/analytics/refresh').expect(200, { captured: 2 });
    // Second refresh inside the 30-minute window is a no-op.
    await http.post('/api/analytics/refresh').expect(200, { captured: 0 });

    const overview = await http
      .get('/api/analytics/overview?days=7')
      .expect(200);
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

    const feed = await http.get('/api/feed?platform=mastodon').expect(200);
    const target = feed.body.items[0];
    expect(target.metrics).toMatchObject({ likes: 7, reposts: 3, replies: 2 });
    const history = await http
      .get(`/api/analytics/targets/${target.id}/history`)
      .expect(200);
    expect(history.body).toHaveLength(1);
  });

  it('retries transient failures with backoff and flags revoked tokens', async () => {
    const post = await http
      .post('/api/posts')
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
      await dataSource.query(
        `SELECT "scheduledAt", attempts FROM post_targets WHERE id = $1`,
        [targetId],
      );
    expect(retry.attempts).toBe(1);
    expect(new Date(retry.scheduledAt).getTime()).toBeGreaterThan(Date.now());

    mastodonStatus = 401;
    const now = await http
      .post(`/api/posts/${post.body.id}/publish`)
      .expect(200);
    expect(now.body).toEqual([
      { targetId, status: 'failed', error: 'HTTP 401' },
    ]);
    const account = await http.get(`/api/accounts/${mastodonId}`).expect(200);
    expect(account.body).toMatchObject({
      status: 'needs_reconnect',
      lastError: 'HTTP 401',
    });

    // Reconnecting clears the flag.
    await http
      .post('/api/accounts')
      .send({
        platform: 'mastodon',
        credentials: {
          instanceUrl: 'https://mastodon.social',
          accessToken: MASTODON_TOKEN,
        },
      })
      .expect(201);
    await http.delete(`/api/posts/${post.body.id}`).expect(204);
  });

  it('turns an agent plan into drafts, dropping suggestions that break rules', async () => {
    const start = new Date(Date.now() + 86_400_000);
    const at = (h: number) =>
      new Date(start.getTime() + h * 3_600_000).toISOString();
    model.generateJson.mockResolvedValueOnce({
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

    const plan = await http
      .post('/api/agent/plan')
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

    const prompt = model.generateJson.mock.calls[0][0].prompt as string;
    expect(prompt).toContain('Warm, concise, no jargon');
    expect(prompt).toContain('Africa/Kampala');

    const postId: string = plan.body.posts[0].id;
    const scheduled = await http
      .post(`/api/posts/${postId}/schedule`)
      .send({})
      .expect(200);
    expect(scheduled.body.status).toBe('scheduled');

    const calendar = await http
      .get('/api/calendar')
      .query({ from: start.toISOString(), to: at(24 * 7) })
      .expect(200);
    expect(calendar.body.map((i: { postId: string }) => i.postId)).toContain(
      postId,
    );
  });

  it('rejects malformed model output instead of saving it', async () => {
    model.generateJson.mockResolvedValueOnce({
      posts: [{ title: 'No targets' }],
    });
    await http
      .post('/api/agent/plan')
      .send({
        brief: 'Anything at all here',
        accountIds: [mastodonId],
        startDate: new Date().toISOString(),
      })
      .expect(502);
  });
});
