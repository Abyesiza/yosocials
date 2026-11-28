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
 * LinkedIn end to end: OAuth (OpenID Connect), posting text, photos and
 * video through the Posts, Images and Videos APIs, analytics, token expiry
 * and disconnecting. LinkedIn and our media URLs are stubbed (shapes per
 * learn.microsoft.com/linkedin).
 */

const API = 'api.linkedin.com';
const WWW = 'www.linkedin.com';
const MEDIA = 'abysocials.test';
const MEMBER = 'Ab12Cd34';
const ACCESS = 'li-access-token-plaintext';
const VIDEO_BYTES = 6 * 1024 * 1024;
const PART = 4 * 1024 * 1024;

let t: TestApp;
let owner: SignedUp;
let liId: string;
let calls: RecordedRequest[];
let imageCount = 0;
let createPost: () => {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
};

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
const posts = () => sent(`${API}/rest/posts`);

function stub() {
  const mock = mockFetch({
    [`POST ${WWW}/oauth/v2/accessToken`]: () => ({
      body: {
        access_token: ACCESS,
        expires_in: 5184000,
        scope: 'openid,profile,w_member_social,r_member_postAnalytics',
      },
    }),
    [`GET ${API}/v2/userinfo`]: () => ({
      body: {
        sub: MEMBER,
        name: 'Aby Creator',
        given_name: 'Aby',
        family_name: 'Creator',
        picture: 'https://media.licdn.com/dms/image/abc/profile.jpg',
      },
    }),
    [`GET ${MEDIA}/media/*`]: (req) => ({
      raw: req.url.pathname.endsWith('.mp4')
        ? 'v'.repeat(VIDEO_BYTES)
        : 'jpeg-bytes',
    }),
    [`POST ${API}/rest/images`]: () => {
      imageCount++;
      return {
        body: {
          value: {
            uploadUrl: `https://${WWW}/dms-uploads/IMG${imageCount}/uploaded-image/0`,
            image: `urn:li:image:IMG${imageCount}`,
          },
        },
      };
    },
    [`POST ${API}/rest/videos`]: (req) => {
      if (req.url.searchParams.get('action') === 'finalizeUpload')
        return { body: {} };
      const size = (
        req.body as { initializeUploadRequest: { fileSizeBytes: number } }
      ).initializeUploadRequest.fileSizeBytes;
      return {
        body: {
          value: {
            video: 'urn:li:video:VID1',
            uploadToken: 'upload-token',
            uploadInstructions: [
              {
                uploadUrl: `https://${WWW}/dms-uploads/VID1/part0`,
                firstByte: 0,
                lastByte: PART - 1,
              },
              {
                uploadUrl: `https://${WWW}/dms-uploads/VID1/part1`,
                firstByte: PART,
                lastByte: size - 1,
              },
            ],
          },
        },
      };
    },
    [`GET ${API}/rest/videos/*`]: () => ({
      body: { id: 'urn:li:video:VID1', status: 'AVAILABLE' },
    }),
    [`PUT ${WWW}/dms-uploads/*`]: (req) => ({
      status: 201,
      headers: { etag: `etag-${req.url.pathname.split('/').pop()}` },
    }),
    [`POST ${API}/rest/posts`]: () => createPost(),
    [`GET ${API}/rest/memberCreatorPostAnalytics`]: (req) => {
      const counts: Record<string, number> = {
        IMPRESSION: 500,
        REACTION: 25,
        COMMENT: 4,
        RESHARE: 2,
      };
      const type = req.url.searchParams.get('queryType')!;
      return {
        body: {
          elements: [{ count: counts[type], metricType: type }],
          paging: {},
        },
      };
    },
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

async function publish(body: string, media: object[] = [], expected = 200) {
  const post = await api
    .post('/posts')
    .send({ body, media, targets: [{ accountId: liId }] })
    .expect(201);
  const res = await api.post(`/posts/${post.body.id}/publish`).expect(expected);
  return { post: post.body, outcome: res.body[0], res };
}

beforeAll(async () => {
  t = await startTestApp();
  owner = await signUp(t.http, 'LinkedIn owner');
}, 60_000);

beforeEach(() => {
  stub();
  createPost = () => ({
    status: 201,
    headers: { 'x-restli-id': 'urn:li:share:7100000000000000001' },
  });
});
afterEach(() => vi.unstubAllGlobals());
afterAll(() => t?.close());

describe('LinkedIn', () => {
  it('is listed as an OAuth platform with LinkedIn’s limits', async () => {
    const res = await t.http.get('/api/integrations').expect(200);
    expect(
      res.body.find((p: { platform: string }) => p.platform === 'linkedin'),
    ).toMatchObject({
      connect: 'oauth',
      available: true,
      maxTextLength: 3000,
      media: { required: false, video: true, maxImages: 20 },
    });
  });

  it('connects with OpenID Connect and keeps the token encrypted', async () => {
    const start = await api.post('/accounts/oauth/linkedin/start').expect(200);
    const url = new URL(start.body.url);
    expect(url.origin + url.pathname).toBe(
      'https://www.linkedin.com/oauth/v2/authorization',
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: 'code',
      client_id: 'li-client-id',
      redirect_uri: 'https://abysocials.test/integrations/linkedin/callback',
      scope: 'openid profile w_member_social r_member_postAnalytics',
      state: start.body.state,
    });

    const res = await api
      .post('/accounts/oauth/linkedin/callback')
      .send({ code: 'auth-code', state: start.body.state })
      .expect(201);
    expect(res.body).toMatchObject({
      platform: 'linkedin',
      handle: 'Aby Creator',
      displayName: 'Aby Creator',
      status: 'active',
    });
    liId = res.body.id;

    const token = form(sent(`${WWW}/oauth/v2/accessToken`)[0]);
    expect(Object.fromEntries(token)).toEqual({
      grant_type: 'authorization_code',
      code: 'auth-code',
      redirect_uri: 'https://abysocials.test/integrations/linkedin/callback',
      client_id: 'li-client-id',
      client_secret: 'li-client-secret',
    });
    const [session] = await t.dataSource.query(
      `SELECT "encryptedData" FROM provider_sessions WHERE key = $1`,
      [`linkedin:${MEMBER}`],
    );
    expect(session.encryptedData).not.toContain(ACCESS);
  });

  it('publishes text, escaping LinkedIn’s reserved characters but keeping hashtags', async () => {
    const { post, outcome } = await publish(
      'Launch day (finally)! Use code [AB_2] #launch #UgandaTech',
    );
    expect(outcome.status).toBe('published');

    const [create] = posts();
    expect(create.headers).toMatchObject({
      authorization: `Bearer ${ACCESS}`,
      'linkedin-version': '202611',
      'x-restli-protocol-version': '2.0.0',
    });
    expect(create.body).toEqual({
      author: `urn:li:person:${MEMBER}`,
      commentary:
        'Launch day \\(finally\\)! Use code \\[AB\\_2\\] #launch #UgandaTech',
      visibility: 'PUBLIC',
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    });
    const target = (await api.get(`/posts/${post.id}`)).body.targets[0];
    expect(target).toMatchObject({
      externalUrl:
        'https://www.linkedin.com/feed/update/urn:li:share:7100000000000000001/',
    });
  });

  it('uploads several photos and posts them as a multi-image post', async () => {
    const photos = [await upload('image/jpeg'), await upload('image/jpeg')];
    const { outcome } = await publish('Two photos', photos);
    expect(outcome.status).toBe('published');

    const inits = sent(`${API}/rest/images`);
    expect(inits.map((c) => c.url.searchParams.get('action'))).toEqual([
      'initializeUpload',
      'initializeUpload',
    ]);
    expect(inits[0].body).toEqual({
      initializeUploadRequest: { owner: `urn:li:person:${MEMBER}` },
    });
    const puts = calls.filter((c) => c.method === 'PUT');
    expect(puts).toHaveLength(2);
    expect(puts[0].headers.authorization).toBe(`Bearer ${ACCESS}`);
    expect((posts()[0].body as { content: unknown }).content).toEqual({
      multiImage: {
        images: [
          { id: `urn:li:image:IMG${imageCount - 1}` },
          { id: `urn:li:image:IMG${imageCount}` },
        ],
      },
    });
  });

  it('refuses WebP photos before calling LinkedIn', async () => {
    const photo = await upload('image/webp');
    const { res } = await publish('WebP', [photo], 400);
    expect(JSON.stringify(res.body)).toMatch(/JPEG, PNG or GIF/);
    expect(posts()).toHaveLength(0);
  });

  it('uploads video in the parts LinkedIn asks for, then finalizes with their ETags', async () => {
    const video = {
      ...(await upload('video/mp4', VIDEO_BYTES)),
      durationSec: 42,
    };
    const { outcome } = await publish('Watch this', [video]);
    expect(outcome.status).toBe('published');

    const [init, finalize] = sent(`${API}/rest/videos`);
    expect(init.body).toEqual({
      initializeUploadRequest: {
        owner: `urn:li:person:${MEMBER}`,
        fileSizeBytes: VIDEO_BYTES,
        uploadCaptions: false,
        uploadThumbnail: false,
      },
    });
    const puts = calls.filter((c) => c.method === 'PUT');
    expect(puts.map((p) => (p.body as Uint8Array).length)).toEqual([
      PART,
      VIDEO_BYTES - PART,
    ]);
    expect(finalize.body).toEqual({
      finalizeUploadRequest: {
        video: 'urn:li:video:VID1',
        uploadToken: 'upload-token',
        uploadedPartIds: ['etag-part0', 'etag-part1'],
      },
    });
    expect((posts()[0].body as { content: unknown }).content).toEqual({
      media: { id: 'urn:li:video:VID1' },
    });
  });

  it('explains a duplicate post without flagging the account', async () => {
    createPost = () => ({
      status: 422,
      body: {
        message: 'Content is a duplicate of urn:li:share:7100000000000000001',
        status: 422,
      },
    });
    const { outcome } = await publish('Same again');
    expect(outcome.status).toBe('failed');
    expect(outcome.error).toMatch(/duplicate of a recent post/);
    expect((await api.get(`/accounts/${liId}`)).body.status).toBe('active');
  });

  it('reads post analytics when the analytics permission was granted', async () => {
    const captured = await t.app
      .get(AnalyticsService)
      .collectDue(owner.workspaceId);
    expect(captured).toBeGreaterThan(0);

    const lookups = sent(`${API}/rest/memberCreatorPostAnalytics`);
    expect(
      lookups.map((c) => c.url.searchParams.get('queryType')).slice(0, 4),
    ).toEqual(['IMPRESSION', 'REACTION', 'COMMENT', 'RESHARE']);
    // Rest.li syntax: structural characters plain, the URN inside encoded.
    expect(lookups[0].url.search).toContain(
      'entity=(share:urn%3Ali%3Ashare%3A7100000000000000001)',
    );
    const list = (await api.get('/posts')).body;
    const published = (list.items ?? list).find(
      (p: { targets: { status: string }[] }) =>
        p.targets[0].status === 'published',
    );
    expect(published.targets[0].metrics).toMatchObject({
      likes: 25,
      replies: 4,
      reposts: 2,
      views: 500,
    });
  });

  it('asks for a reconnect once the 60-day token has run out', async () => {
    const sessions = t.app.get(ProviderSessionsService);
    const key = `linkedin:${MEMBER}`;
    const tokens = await sessions.load<Record<string, unknown>>(key);
    await sessions.save(key, 'linkedin' as never, {
      ...tokens,
      expiresAt: Date.now() - 1000,
    });

    await api.post(`/accounts/${liId}/verify`).expect(400);
    const account = (await api.get(`/accounts/${liId}`)).body;
    expect(account.status).toBe('needs_reconnect');
    expect(account.lastError).toMatch(/Reconnect the account/);
    expect(sent(`${WWW}/oauth/v2/accessToken`)).toHaveLength(0);
  });

  it('forgets the token when the account is disconnected', async () => {
    await api.delete(`/accounts/${liId}`).expect(204);
    const rows = await t.dataSource.query(
      `SELECT 1 FROM provider_sessions WHERE key = $1`,
      [`linkedin:${MEMBER}`],
    );
    expect(rows).toHaveLength(0);
  });
});
