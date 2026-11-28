import { createHash } from 'node:crypto';
import { AnalyticsService } from '../src/modules/analytics/analytics.service.js';
import { ProviderSessionsService } from '../src/modules/integrations/sessions/provider-sessions.service.js';
import { mockFetch, type RecordedRequest } from './support/mock-fetch.js';
import {
  signUp,
  startTestApp,
  type SignedUp,
  type TestApp,
} from './support/test-app.js';

/**
 * X end to end: OAuth 2.0 with PKCE, weighted text length, publishing text,
 * photos and chunked video, metrics, token refresh and disconnecting.
 * X, UploadThing and our media URLs are stubbed (shapes per api.x.com/2/openapi.json).
 */

const X = 'api.x.com';
const MEDIA = 'abysocials.test';
const USER_ID = '1700000000000000001';
const ACCESS = 'x-access-token-plaintext';
const BASIC = `Basic ${Buffer.from('x-client-id:x-client-secret').toString('base64')}`;
const VIDEO_BYTES = 9 * 1024 * 1024;

let t: TestApp;
let owner: SignedUp;
let xId: string;
let calls: RecordedRequest[];
let refreshCount = 0;
let createPost: () => { status?: number; body: unknown };

const api = {
  get: (path: string) =>
    t.http.get(`/api/workspaces/${owner.workspaceId}${path}`).set(owner.auth),
  post: (path: string) =>
    t.http.post(`/api/workspaces/${owner.workspaceId}${path}`).set(owner.auth),
  delete: (path: string) =>
    t.http
      .delete(`/api/workspaces/${owner.workspaceId}${path}`)
      .set(owner.auth),
};

const sent = (path: string) =>
  calls.filter((c) => `${c.url.host}${c.url.pathname}` === path);
const form = (c: RecordedRequest) => new URLSearchParams(c.body as string);
const multipartText = (c: RecordedRequest) =>
  Buffer.from(c.body as Uint8Array).toString('latin1');

function stub() {
  const mock = mockFetch({
    [`POST ${X}/2/oauth2/token`]: (req) => {
      const refresh = form(req).get('grant_type') === 'refresh_token';
      if (refresh) refreshCount++;
      return {
        body: {
          token_type: 'bearer',
          access_token: refresh ? `${ACCESS}-${refreshCount}` : ACCESS,
          expires_in: 7200,
          refresh_token: refresh ? `refresh-${refreshCount}` : 'refresh-0',
          scope: 'tweet.read tweet.write users.read media.write offline.access',
        },
      };
    },
    [`POST ${X}/2/oauth2/revoke`]: () => ({ body: { revoked: true } }),
    [`GET ${X}/2/users/me`]: () => ({
      body: {
        data: {
          id: USER_ID,
          name: 'Aby Creator',
          username: 'abycreator',
          profile_image_url: 'https://pbs.twimg.com/profile_images/1/a.jpg',
        },
      },
    }),
    [`GET ${MEDIA}/media/*`]: (req) => ({
      raw: req.url.pathname.endsWith('.mp4')
        ? 'v'.repeat(VIDEO_BYTES)
        : 'jpeg-bytes',
    }),
    [`POST ${X}/2/media/upload`]: () => ({
      body: {
        data: { id: '1800000000000000001', media_key: '3_1800000000000000001' },
      },
    }),
    [`POST ${X}/2/media/upload/initialize`]: () => ({
      body: { data: { id: '1800000000000000009', expires_after_secs: 86400 } },
    }),
    [`POST ${X}/2/media/upload/1800000000000000009/append`]: () => ({
      body: {},
    }),
    [`POST ${X}/2/media/upload/1800000000000000009/finalize`]: () => ({
      body: {
        data: {
          id: '1800000000000000009',
          processing_info: { state: 'pending', check_after_secs: 0 },
        },
      },
    }),
    [`GET ${X}/2/media/upload`]: () => ({
      body: {
        data: {
          id: '1800000000000000009',
          processing_info: { state: 'succeeded', progress_percent: 100 },
        },
      },
    }),
    [`POST ${X}/2/tweets`]: () => createPost(),
    [`GET ${X}/2/tweets`]: (req) => ({
      body: {
        data: req.url.searchParams
          .get('ids')!
          .split(',')
          .map((id) => ({
            id,
            text: 'Hello',
            public_metrics: {
              repost_count: 3,
              reply_count: 2,
              like_count: 12,
              quote_count: 1,
              bookmark_count: 4,
              impression_count: 900,
            },
            non_public_metrics: { impression_count: 900, url_link_clicks: 7 },
          })),
      },
    }),
    [`POST api.uploadthing.com/v6/deleteFiles`]: () => ({
      body: { success: true, deletedCount: 0 },
    }),
  });
  calls = mock.calls;
}

async function upload(contentType: string, size = 300_000) {
  const res = await api
    .post('/media/uploads')
    .send({ files: [{ contentType, size }] })
    .expect(201);
  const [path] = res.body.customIds as string[];
  return { path, contentType, size };
}

async function publish(
  body: string,
  media: { path: string; contentType: string; size: number }[] = [],
) {
  const post = await api
    .post('/posts')
    .send({ body, media, targets: [{ accountId: xId }] })
    .expect(201);
  const outcomes = await api.post(`/posts/${post.body.id}/publish`).expect(200);
  return { post: post.body, outcome: outcomes.body[0] };
}

beforeAll(async () => {
  t = await startTestApp();
  owner = await signUp(t.http, 'X owner');
}, 60_000);

beforeEach(() => {
  stub();
  createPost = () => ({
    status: 201,
    body: { data: { id: '1900000000000000001', text: 'Hello' } },
  });
});
afterEach(() => vi.unstubAllGlobals());
afterAll(() => t?.close());

describe('X', () => {
  it('is listed as an OAuth platform with X’s limits', async () => {
    const res = await t.http.get('/api/integrations').expect(200);
    expect(
      res.body.find((p: { platform: string }) => p.platform === 'x'),
    ).toMatchObject({
      connect: 'oauth',
      available: true,
      maxTextLength: 280,
      lengthUnit: 'weighted',
      media: { required: false, video: true, maxImages: 4 },
    });
  });

  it('refuses pasted credentials', async () => {
    await api
      .post('/accounts')
      .send({ platform: 'x', credentials: {} })
      .expect(400);
  });

  it('connects with OAuth 2.0 and PKCE, keeping the tokens encrypted', async () => {
    const start = await api.post('/accounts/oauth/x/start').expect(200);
    const url = new URL(start.body.url);
    expect(url.origin + url.pathname).toBe('https://x.com/i/oauth2/authorize');
    const params = Object.fromEntries(url.searchParams);
    expect(params).toMatchObject({
      response_type: 'code',
      client_id: 'x-client-id',
      redirect_uri: 'https://abysocials.test/integrations/x/callback',
      scope: 'tweet.read tweet.write users.read media.write offline.access',
      state: start.body.state,
      code_challenge_method: 'S256',
    });

    const res = await api
      .post('/accounts/oauth/x/callback')
      .send({ code: 'auth-code', state: start.body.state })
      .expect(201);
    expect(res.body).toMatchObject({
      platform: 'x',
      handle: '@abycreator',
      displayName: 'Aby Creator',
      profileUrl: 'https://x.com/abycreator',
      status: 'active',
    });
    expect(JSON.stringify(res.body)).not.toContain(ACCESS);
    xId = res.body.id;

    const [token] = sent(`${X}/2/oauth2/token`);
    expect(token.headers.authorization).toBe(BASIC);
    const body = form(token);
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe('auth-code');
    expect(body.get('redirect_uri')).toBe(
      'https://abysocials.test/integrations/x/callback',
    );
    // The verifier sent now must hash to the challenge sent at the start.
    const verifier = body.get('code_verifier')!;
    expect(verifier).toMatch(/^[\w-]{43,128}$/);
    expect(createHash('sha256').update(verifier).digest('base64url')).toBe(
      params.code_challenge,
    );

    const [session] = await t.dataSource.query(
      `SELECT "encryptedData" FROM provider_sessions WHERE key = $1`,
      [`x:${USER_ID}`],
    );
    expect(session.encryptedData).not.toContain(ACCESS);
  });

  it('rejects a state from another sign-in before calling X', async () => {
    const other = await signUp(t.http, 'Someone else');
    const foreign = (
      await t.http
        .post(`/api/workspaces/${other.workspaceId}/accounts/oauth/x/start`)
        .set(other.auth)
    ).body.state;
    await api
      .post('/accounts/oauth/x/callback')
      .send({ code: 'c', state: foreign })
      .expect(400);
    expect(sent(`${X}/2/oauth2/token`)).toHaveLength(0);
  });

  it('measures text the way X does', async () => {
    const make = (body: string) =>
      api.post('/posts').send({ body, targets: [{ accountId: xId }] });
    // 377 characters, but the link counts as 23: exactly 280.
    await make(
      `${'a'.repeat(256)} https://example.com/${'x'.repeat(100)}`,
    ).expect(201);
    // 141 CJK characters count double: 282.
    await make('日'.repeat(141)).expect(400);
  });

  it('sends X the copy prepared for it, and shows that copy in the feed', async () => {
    const original = await upload('image/jpeg');
    const copy = await upload('image/jpeg');
    const post = await api
      .post('/posts')
      .send({
        body: 'Prepared for X',
        media: [
          {
            ...original,
            width: 4000,
            height: 6000,
            variants: [
              {
                platform: 'x',
                path: copy.path,
                contentType: 'image/jpeg',
                size: copy.size,
                width: 1365,
                height: 2048,
              },
            ],
          },
        ],
        targets: [{ accountId: xId }],
      })
      .expect(201);
    expect(post.body.media[0].variants).toEqual([
      expect.objectContaining({
        platform: 'x',
        path: copy.path,
        width: 1365,
        height: 2048,
      }),
    ]);

    await api.post(`/posts/${post.body.id}/publish`).expect(200);
    const downloads = calls.filter((c) => c.url.host === 'abysocials.test');
    expect(downloads.map((c) => c.url.pathname)).toEqual([
      `/media/${copy.path}`,
    ]);

    const feed = (await api.get('/feed')).body;
    const item = (feed.items ?? feed).find(
      (i: { postId: string }) => i.postId === post.body.id,
    );
    expect(item.media[0]).toMatchObject({
      path: copy.path,
      width: 1365,
      height: 2048,
    });

    calls.length = 0;
    await api.delete(`/posts/${post.body.id}`).expect(204);
    const deleted = calls.find((c) => c.url.pathname === '/v6/deleteFiles')!;
    expect((deleted.body as { customIds: string[] }).customIds.sort()).toEqual(
      [original.path, copy.path].sort(),
    );
  });

  it('refuses a prepared copy from another workspace', async () => {
    const original = await upload('image/jpeg');
    const foreign = original.path.replace(
      /^[0-9a-f-]{36}/,
      crypto.randomUUID(),
    );
    await api
      .post('/posts')
      .send({
        body: 'Sneaky',
        media: [
          {
            ...original,
            variants: [
              {
                platform: 'x',
                path: foreign,
                contentType: 'image/jpeg',
                size: 10,
              },
            ],
          },
        ],
        targets: [{ accountId: xId }],
      })
      .expect(400);
  });

  it('blocks publishing when the copy X gets breaks its limits', async () => {
    const original = await upload('image/jpeg', 6_000_000);
    const post = await api
      .post('/posts')
      .send({
        body: 'Too big',
        media: [{ ...original, width: 3000, height: 2000 }],
        targets: [{ accountId: xId }],
      })
      .expect(201);
    const res = await api.post(`/posts/${post.body.id}/publish`).expect(400);
    expect(JSON.stringify(res.body)).toMatch(/photos up to 5 MB/);
    expect(sent(`${X}/2/tweets`)).toHaveLength(0);
  });

  it('publishes text with photos uploaded to X', async () => {
    const photo = await upload('image/jpeg');
    const { outcome } = await publish('Hello from Aby Socials', [photo]);
    expect(outcome.status).toBe('published');

    const [media] = sent(`${X}/2/media/upload`);
    expect(media.headers.authorization).toBe(`Bearer ${ACCESS}`);
    expect(multipartText(media)).toContain('tweet_image');
    expect(multipartText(media)).toContain('jpeg-bytes');
    expect(sent(`${X}/2/tweets`)[0].body).toEqual({
      text: 'Hello from Aby Socials',
      media: { media_ids: ['1800000000000000001'] },
    });
  });

  it('uploads video in chunks and waits for X to process it', async () => {
    const video = await upload('video/mp4', VIDEO_BYTES);
    const { post, outcome } = await publish('Watch this', [video]);
    expect(outcome.status).toBe('published');

    expect(sent(`${X}/2/media/upload/initialize`)[0].body).toEqual({
      media_type: 'video/mp4',
      total_bytes: VIDEO_BYTES,
      media_category: 'tweet_video',
    });
    const appends = sent(`${X}/2/media/upload/1800000000000000009/append`);
    expect(appends).toHaveLength(3);
    expect(
      appends.map(
        (a) => multipartText(a).match(/name="segment_index"\r\n\r\n(\d+)/)?.[1],
      ),
    ).toEqual(['0', '1', '2']);
    expect(
      sent(`${X}/2/media/upload`)
        .filter((c) => c.method === 'GET')[0]
        .url.searchParams.get('command'),
    ).toBe('STATUS');
    expect(sent(`${X}/2/tweets`)[0].body).toEqual({
      text: 'Watch this',
      media: { media_ids: ['1800000000000000009'] },
    });
    const target = (await api.get(`/posts/${post.id}`)).body.targets[0];
    expect(target.externalUrl).toBe(
      'https://x.com/i/web/status/1900000000000000001',
    );
  });

  it('explains when X rejects a duplicate post', async () => {
    createPost = () => ({
      status: 403,
      body: {
        title: 'Forbidden',
        type: 'about:blank',
        status: 403,
        detail: 'You are not allowed to create a Tweet with duplicate content.',
      },
    });
    const { outcome } = await publish('Same again');
    expect(outcome.status).toBe('failed');
    expect(outcome.error).toMatch(/duplicate of a recent post/);
    // A rejected post isn't an access problem: the account stays connected.
    expect((await api.get(`/accounts/${xId}`)).body.status).toBe('active');
  });

  it('reads metrics for published posts, then waits before reading again', async () => {
    const analytics = t.app.get(AnalyticsService);
    const captured = await analytics.collectDue(owner.workspaceId);
    expect(captured).toBeGreaterThan(0);

    const lookup = sent(`${X}/2/tweets`).find((c) => c.method === 'GET')!;
    expect(lookup.url.searchParams.get('post.fields')).toBe(
      'public_metrics,non_public_metrics,organic_metrics',
    );
    const posts = (await api.get('/posts')).body;
    const published = (posts.items ?? posts).find(
      (p: { targets: { status: string }[] }) =>
        p.targets[0].status === 'published',
    );
    expect(published.targets[0].metrics).toMatchObject({
      likes: 12,
      reposts: 3,
      replies: 2,
      quotes: 1,
      views: 900,
    });

    calls.length = 0;
    expect(await analytics.collectDue(owner.workspaceId)).toBe(0);
    expect(sent(`${X}/2/tweets`)).toHaveLength(0);
  });

  it('refreshes an expired token once, even when two calls need it at the same time', async () => {
    const sessions = t.app.get(ProviderSessionsService);
    const key = `x:${USER_ID}`;
    const tokens = await sessions.load<Record<string, unknown>>(key);
    await sessions.save(key, 'x' as never, { ...tokens, expiresAt: 0 });

    await Promise.all([
      api.post(`/accounts/${xId}/verify`).expect(200),
      api.post(`/accounts/${xId}/verify`).expect(200),
    ]);
    const refreshes = sent(`${X}/2/oauth2/token`).map(form);
    expect(refreshes).toHaveLength(1);
    expect(refreshes[0].get('grant_type')).toBe('refresh_token');
    expect(refreshes[0].get('refresh_token')).toBe('refresh-0');
    // X rotates refresh tokens: the new one replaces the used one.
    expect(
      (await sessions.load<{ refreshToken: string }>(key))?.refreshToken,
    ).toBe(`refresh-${refreshCount}`);
  });

  it('revokes X access when the account is disconnected', async () => {
    await api.delete(`/accounts/${xId}`).expect(204);
    const revoked = sent(`${X}/2/oauth2/revoke`);
    expect(revoked.map((c) => form(c).get('token'))).toEqual([
      `refresh-${refreshCount}`,
      `${ACCESS}-${refreshCount}`,
    ]);
    expect(revoked[0].headers.authorization).toBe(BASIC);
    const rows = await t.dataSource.query(
      `SELECT 1 FROM provider_sessions WHERE key = $1`,
      [`x:${USER_ID}`],
    );
    expect(rows).toHaveLength(0);
  });
});
