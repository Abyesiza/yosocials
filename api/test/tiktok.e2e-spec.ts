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
 * TikTok end to end: OAuth connect, media uploads to Supabase Storage,
 * Direct Post and inbox uploads, asynchronous publish status, metrics and
 * disconnecting. TikTok and Supabase are stubbed.
 */

const TT = 'open.tiktokapis.com';
const SUPA = 'supabase.test/storage/v1';
const OPEN_ID = 'open-id-123';
const ACCESS = 'act.access-token-plaintext';

let t: TestApp;
let owner: SignedUp;
let tiktokId: string;
let calls: RecordedRequest[];
/** Raw JSON, so tests can send 19-digit ids the way TikTok does. */
let publishStatus = '{"status":"PROCESSING_DOWNLOAD"}';
let privacyOptions = ['PUBLIC_TO_EVERYONE', 'SELF_ONLY'];

const ok = (data: unknown) => ({ body: { data, error: { code: 'ok' } } });

const api = {
  get: (path: string) =>
    t.http.get(`/api/workspaces/${owner.workspaceId}${path}`).set(owner.auth),
  post: (path: string) =>
    t.http.post(`/api/workspaces/${owner.workspaceId}${path}`).set(owner.auth),
  patch: (path: string) =>
    t.http.patch(`/api/workspaces/${owner.workspaceId}${path}`).set(owner.auth),
  delete: (path: string) =>
    t.http
      .delete(`/api/workspaces/${owner.workspaceId}${path}`)
      .set(owner.auth),
};

const sent = (path: string) =>
  calls.filter((c) => `${c.url.host}${c.url.pathname}` === path);

function stub() {
  const mock = mockFetch({
    [`POST ${TT}/v2/oauth/token/`]: () => ({
      body: {
        access_token: ACCESS,
        expires_in: 86400,
        open_id: OPEN_ID,
        refresh_token: 'rft.refresh-token',
        refresh_expires_in: 31536000,
        scope:
          'user.info.basic,user.info.profile,video.publish,video.upload,video.list',
        token_type: 'Bearer',
      },
    }),
    [`POST ${TT}/v2/oauth/revoke/`]: () => ({ body: {} }),
    [`GET ${TT}/v2/user/info/`]: () =>
      ok({
        user: {
          open_id: OPEN_ID,
          display_name: 'Creator',
          username: 'creator',
          avatar_url: 'https://p16.tiktokcdn.com/avatar.jpg',
          profile_deep_link: 'https://vm.tiktok.com/creator',
        },
      }),
    [`POST ${TT}/v2/post/publish/creator_info/query/`]: () =>
      ok({
        creator_avatar_url: 'https://p16.tiktokcdn.com/avatar.jpg',
        creator_username: 'creator',
        creator_nickname: 'Creator',
        privacy_level_options: privacyOptions,
        comment_disabled: false,
        duet_disabled: true,
        stitch_disabled: false,
        max_video_post_duration_sec: 300,
      }),
    [`POST ${TT}/v2/post/publish/video/init/`]: () =>
      ok({ publish_id: 'v_pub_url~v2.1' }),
    [`POST ${TT}/v2/post/publish/content/init/`]: () =>
      ok({ publish_id: 'p_pub_url~v2.2' }),
    [`POST ${TT}/v2/post/publish/status/fetch/`]: () => ({
      raw: `{"data":${publishStatus},"error":{"code":"ok"}}`,
    }),
    [`POST ${TT}/v2/video/query/`]: (req) =>
      ok({
        videos: (
          req.body as { filters: { video_ids: string[] } }
        ).filters.video_ids.map((id) => ({
          id,
          share_url: `https://www.tiktok.com/@creator/video/${id}`,
          like_count: 40,
          comment_count: 5,
          share_count: 3,
          view_count: 1200,
        })),
      }),
    [`GET ${SUPA}/bucket/media`]: () => ({
      status: 400,
      body: { statusCode: '404', error: 'Bucket not found' },
    }),
    [`POST ${SUPA}/bucket`]: () => ({ body: { name: 'media' } }),
    [`POST ${SUPA}/object/upload/sign/media/*`]: (req) => ({
      body: {
        url: `${req.url.pathname.replace('/storage/v1', '')}?token=signed`,
      },
    }),
    [`DELETE ${SUPA}/object/media`]: () => ({ body: [] }),
    [`POST ${SUPA}/object/list/media`]: () => ({ body: [] }),
  });
  calls = mock.calls;
}

async function upload(contentType: string) {
  const res = await api
    .post('/media/uploads')
    .send({ contentType, size: 5_000_000 })
    .expect(201);
  return res.body as { path: string; uploadUrl: string; publicUrl: string };
}

beforeAll(async () => {
  t = await startTestApp();
  owner = await signUp(t.http, 'TikTok owner');
}, 60_000);

beforeEach(() => stub());
afterEach(() => vi.unstubAllGlobals());
afterAll(() => t?.close());

describe('TikTok', () => {
  it('is listed as an OAuth platform that needs media', async () => {
    const res = await t.http.get('/api/integrations').expect(200);
    expect(
      res.body.find((p: { platform: string }) => p.platform === 'tiktok'),
    ).toMatchObject({
      connect: 'oauth',
      available: true,
      maxTextLength: 2200,
      media: { required: true, video: true, maxImages: 35 },
    });
  });

  it('refuses pasted credentials', async () => {
    await api
      .post('/accounts')
      .send({ platform: 'tiktok', credentials: {} })
      .expect(400);
  });

  it('builds the authorize URL with a signed state', async () => {
    const res = await api.post('/accounts/oauth/tiktok/start').expect(200);
    const url = new URL(res.body.url);
    expect(url.origin + url.pathname).toBe(
      'https://www.tiktok.com/v2/auth/authorize/',
    );
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_key: 'test-client-key',
      response_type: 'code',
      redirect_uri: 'https://abysocials.test/integrations/tiktok/callback',
      scope:
        'user.info.basic,user.info.profile,video.publish,video.upload,video.list',
      state: res.body.state,
      disable_auto_auth: '1',
    });
  });

  it('rejects a tampered state, or one started by someone else', async () => {
    const { state } = (await api.post('/accounts/oauth/tiktok/start')).body;
    await api
      .post('/accounts/oauth/tiktok/callback')
      .send({ code: 'c', state: `${state}x` })
      .expect(400);

    const other = await signUp(t.http, 'Someone else');
    const foreign = (
      await t.http
        .post(
          `/api/workspaces/${other.workspaceId}/accounts/oauth/tiktok/start`,
        )
        .set(other.auth)
    ).body.state;
    await api
      .post('/accounts/oauth/tiktok/callback')
      .send({ code: 'c', state: foreign })
      .expect(400);
    expect(sent(`${TT}/v2/oauth/token/`)).toHaveLength(0);
  });

  it('connects through OAuth and keeps the tokens encrypted', async () => {
    const { state } = (await api.post('/accounts/oauth/tiktok/start')).body;
    const res = await api
      .post('/accounts/oauth/tiktok/callback')
      .send({ code: 'auth-code', state })
      .expect(201);

    expect(res.body).toMatchObject({
      platform: 'tiktok',
      handle: '@creator',
      displayName: 'Creator',
      status: 'active',
    });
    expect(JSON.stringify(res.body)).not.toContain(ACCESS);
    tiktokId = res.body.id;

    const token = sent(`${TT}/v2/oauth/token/`)[0];
    expect(new URLSearchParams(token.body as string).get('code')).toBe(
      'auth-code',
    );
    const [session] = await t.dataSource.query(
      `SELECT "encryptedData" FROM provider_sessions WHERE key = $1`,
      [`tiktok:${OPEN_ID}`],
    );
    expect(session.encryptedData).not.toContain(ACCESS);
  });

  it('returns creator info for the composer', async () => {
    const res = await api.get(`/accounts/${tiktokId}/creator-info`).expect(200);
    expect(res.body).toEqual({
      nickname: 'Creator',
      username: 'creator',
      avatarUrl: 'https://p16.tiktokcdn.com/avatar.jpg',
      privacyLevelOptions: ['PUBLIC_TO_EVERYONE', 'SELF_ONLY'],
      commentDisabled: false,
      duetDisabled: true,
      stitchDisabled: false,
      maxVideoPostDurationSec: 300,
      canDirectPost: true,
      canUploadToInbox: true,
    });
  });

  it('issues signed upload URLs under the workspace, creating the bucket once', async () => {
    const ticket = await upload('video/mp4');
    expect(ticket.path).toMatch(
      new RegExp(`^${owner.workspaceId}/[0-9a-f-]{36}\\.mp4$`),
    );
    expect(ticket.uploadUrl).toBe(
      `https://supabase.test/storage/v1/object/upload/sign/media/${ticket.path}?token=signed`,
    );
    expect(ticket.publicUrl).toBe(
      `https://abysocials.test/media/${ticket.path}`,
    );
    expect(sent(`${SUPA}/bucket`)[0].body).toMatchObject({ public: true });

    await upload('image/jpeg');
    expect(sent(`${SUPA}/bucket`)).toHaveLength(1);

    await api
      .post('/media/uploads')
      .send({ contentType: 'application/pdf', size: 10 })
      .expect(400);
  });

  it('keeps media to one video or images only, from this workspace', async () => {
    const video = await upload('video/mp4');
    const image = await upload('image/jpeg');
    const item = (u: { path: string }, contentType: string) => ({
      path: u.path,
      contentType,
      size: 5_000_000,
    });
    const base = { body: 'Caption', targets: [{ accountId: tiktokId }] };

    await api
      .post('/posts')
      .send({
        ...base,
        media: [item(video, 'video/mp4'), item(image, 'image/jpeg')],
      })
      .expect(400);
    await api
      .post('/posts')
      .send({
        ...base,
        media: [
          item(
            {
              path: video.path.replace(owner.workspaceId, crypto.randomUUID()),
            },
            'video/mp4',
          ),
        ],
      })
      .expect(400);
  });

  it('only schedules TikTok posts that have media and settings', async () => {
    const res = await api
      .post('/posts')
      .send({
        body: 'Caption',
        scheduledAt: new Date(Date.now() + 3_600_000).toISOString(),
        targets: [{ accountId: tiktokId }],
      })
      .expect(400);
    expect(res.body.message.join(' ')).toMatch(/add a video or photos/);

    await api
      .post('/posts')
      .send({
        body: 'Caption',
        targets: [
          {
            accountId: tiktokId,
            options: { mode: 'direct', privacyLevel: 'EVERYONE' },
          },
        ],
      })
      .expect(400);
  });

  it('direct-posts a video, then follows TikTok’s processing to the live post', async () => {
    const video = await upload('video/mp4');
    const post = await api
      .post('/posts')
      .send({
        body: 'Watch this #fyp',
        media: [
          {
            path: video.path,
            contentType: 'video/mp4',
            size: 5_000_000,
            durationSec: 42,
          },
        ],
        targets: [
          {
            accountId: tiktokId,
            options: {
              mode: 'direct',
              privacyLevel: 'SELF_ONLY',
              allowComment: true,
              allowDuet: true,
              isAigc: true,
            },
          },
        ],
      })
      .expect(201);
    expect(post.body.media[0].url).toBe(video.publicUrl);

    const outcomes = await api
      .post(`/posts/${post.body.id}/publish`)
      .expect(200);
    expect(outcomes.body).toEqual([
      { targetId: post.body.targets[0].id, status: 'processing' },
    ]);
    expect(sent(`${TT}/v2/post/publish/creator_info/query/`)).toHaveLength(1);
    expect(sent(`${TT}/v2/post/publish/video/init/`)[0].body).toEqual({
      post_info: {
        title: 'Watch this #fyp',
        privacy_level: 'SELF_ONLY',
        disable_comment: false,
        // The creator turned duets off in TikTok, which wins over the choice.
        disable_duet: true,
        disable_stitch: true,
        brand_content_toggle: false,
        brand_organic_toggle: false,
        is_aigc: true,
      },
      source_info: { source: 'PULL_FROM_URL', video_url: video.publicUrl },
    });

    publishStatus = '{"status":"PROCESSING_DOWNLOAD"}';
    await api.post(`/posts/${post.body.id}/sync`).expect(200);
    expect((await api.get(`/posts/${post.body.id}`)).body.status).toBe(
      'publishing',
    );

    publishStatus =
      '{"status":"PUBLISH_COMPLETE","publicaly_available_post_id":[7300000000000000001]}';
    const synced = await api.post(`/posts/${post.body.id}/sync`).expect(200);
    expect(synced.body[0].status).toBe('published');
    const target = (await api.get(`/posts/${post.body.id}`)).body.targets[0];
    expect(target).toMatchObject({
      status: 'published',
      externalUrl: 'https://www.tiktok.com/@creator/video/7300000000000000001',
    });

    await t.app.get(AnalyticsService).collectDue(owner.workspaceId);
    const after = (await api.get(`/posts/${post.body.id}`)).body.targets[0];
    expect(after.metrics).toMatchObject({
      likes: 40,
      replies: 5,
      reposts: 3,
      views: 1200,
    });
  });

  it('sends photos to the TikTok inbox as a draft', async () => {
    const photos = [await upload('image/jpeg'), await upload('image/webp')];
    const post = await api
      .post('/posts')
      .send({
        body: 'Our new menu',
        media: [
          { path: photos[0].path, contentType: 'image/jpeg', size: 300_000 },
          { path: photos[1].path, contentType: 'image/webp', size: 300_000 },
        ],
        targets: [
          {
            accountId: tiktokId,
            options: { mode: 'inbox', photoTitle: 'Menu' },
          },
        ],
      })
      .expect(201);

    await api.post(`/posts/${post.body.id}/publish`).expect(200);
    expect(sent(`${TT}/v2/post/publish/creator_info/query/`)).toHaveLength(0);
    expect(sent(`${TT}/v2/post/publish/content/init/`)[0].body).toEqual({
      post_info: { title: 'Menu', description: 'Our new menu' },
      source_info: {
        source: 'PULL_FROM_URL',
        photo_cover_index: 0,
        photo_images: photos.map((p) => p.publicUrl),
      },
      post_mode: 'MEDIA_UPLOAD',
      media_type: 'PHOTO',
    });

    publishStatus = '{"status":"SEND_TO_USER_INBOX"}';
    await api.post(`/posts/${post.body.id}/sync`).expect(200);
    const target = (await api.get(`/posts/${post.body.id}`)).body.targets[0];
    expect(target.status).toBe('processing');
    expect(target.lastError).toMatch(/inbox/);
  });

  it('fails a direct post whose privacy choice the creator no longer has', async () => {
    const video = await upload('video/mp4');
    const post = await api
      .post('/posts')
      .send({
        body: 'Hello',
        media: [
          { path: video.path, contentType: 'video/mp4', size: 5_000_000 },
        ],
        targets: [
          {
            accountId: tiktokId,
            options: { mode: 'direct', privacyLevel: 'PUBLIC_TO_EVERYONE' },
          },
        ],
      })
      .expect(201);

    privacyOptions = ['SELF_ONLY'];
    const res = await api.post(`/posts/${post.body.id}/publish`).expect(200);
    privacyOptions = ['PUBLIC_TO_EVERYONE', 'SELF_ONLY'];
    expect(res.body[0]).toMatchObject({ status: 'failed' });
    expect(res.body[0].error).toMatch(/privacy setting/);
    expect(sent(`${TT}/v2/post/publish/video/init/`)).toHaveLength(0);
  });

  it('refreshes an expired access token before calling TikTok', async () => {
    const sessions = t.app.get(ProviderSessionsService);
    const key = `tiktok:${OPEN_ID}`;
    const tokens = await sessions.load<Record<string, unknown>>(key);
    await sessions.save(key, 'tiktok' as never, { ...tokens, expiresAt: 0 });

    await api.get(`/accounts/${tiktokId}/creator-info`).expect(200);
    const refresh = sent(`${TT}/v2/oauth/token/`).map(
      (c) => new URLSearchParams(c.body as string),
    );
    expect(refresh[0].get('grant_type')).toBe('refresh_token');
    expect(refresh[0].get('refresh_token')).toBe('rft.refresh-token');
  });

  it('revokes TikTok access when the account is disconnected', async () => {
    await api.delete(`/accounts/${tiktokId}`).expect(204);
    expect(sent(`${TT}/v2/oauth/revoke/`)).toHaveLength(1);
    const rows = await t.dataSource.query(
      `SELECT 1 FROM provider_sessions WHERE key = $1`,
      [`tiktok:${OPEN_ID}`],
    );
    expect(rows).toHaveLength(0);
  });
});
