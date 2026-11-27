import { BadRequestException } from '@nestjs/common';
import { PlatformApiError } from '../../../../common/http/http-client.js';
import {
  BLOB_CID,
  createRecordBody,
  DID,
  HANDLE,
  sessionBody,
  tid,
} from '../../../../../test/support/bluesky-fixtures.js';
import {
  mockFetch,
  type RecordedRequest,
} from '../../../../../test/support/mock-fetch.js';
import type { LinkPreviewService } from '../../link-preview/link-preview.service.js';
import type { ProviderSessionsService } from '../../sessions/provider-sessions.service.js';
import { BlueskyClientFactory } from './bluesky-client.js';
import { BlueskyProvider } from './bluesky.provider.js';

const PDS = 'bsky.social/xrpc';
const creds = { identifier: HANDLE, appPassword: 'abcd-efgh-ijkl-mnop' };

function memoryStore() {
  const data = new Map<string, unknown>();
  const store = {
    data,
    load: vi.fn(async (k: string) =>
      data.has(k) ? structuredClone(data.get(k)) : null,
    ),
    save: vi.fn(
      async (k: string, _p: unknown, v: unknown) =>
        void data.set(k, structuredClone(v)),
    ),
    remove: vi.fn(async (k: string) => void data.delete(k)),
  };
  return store;
}

function setup(
  preview: Awaited<ReturnType<LinkPreviewService['fetch']>> = null,
) {
  const store = memoryStore();
  const fetchPreview = vi.fn(async () => preview);
  const previews = { fetch: fetchPreview } as unknown as LinkPreviewService;
  const provider = new BlueskyProvider(
    new BlueskyClientFactory(store as unknown as ProviderSessionsService),
    previews,
  );
  return { store, fetchPreview, provider };
}

const routes = (
  extra: Record<
    string,
    (r: RecordedRequest) => { status?: number; body?: unknown }
  > = {},
) => ({
  [`POST ${PDS}/com.atproto.server.createSession`]: () => ({
    body: sessionBody(),
  }),
  [`POST ${PDS}/com.atproto.server.refreshSession`]: () => ({
    body: sessionBody(),
  }),
  [`POST ${PDS}/com.atproto.server.deleteSession`]: () => ({}),
  [`GET ${PDS}/com.atproto.identity.resolveHandle`]: () => ({
    body: { did: 'did:plc:friend000001' },
  }),
  [`POST ${PDS}/com.atproto.repo.createRecord`]: () => ({
    body: createRecordBody('3k4duaz5vfs2b'),
  }),
  [`GET ${PDS}/app.bsky.actor.getProfile`]: () => ({
    body: {
      did: DID,
      handle: HANDLE,
      displayName: 'Aby Socials',
      avatar: 'https://cdn.bsky.app/a.jpg',
    },
  }),
  ...extra,
});

const path = (r: RecordedRequest) => r.url.pathname.split('/').pop();

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => vi.unstubAllGlobals());

describe('BlueskyProvider (official SDK)', () => {
  it('verifies with a fresh login and reads the profile through the AppView proxy', async () => {
    const { provider, store } = setup();
    const { calls } = mockFetch(routes());

    const account = await provider.verify(creds);

    expect(account).toEqual({
      externalId: DID,
      handle: HANDLE,
      displayName: 'Aby Socials',
      profileUrl: `https://bsky.app/profile/${HANDLE}`,
      avatarUrl: 'https://cdn.bsky.app/a.jpg',
    });
    expect(calls.map(path)).toEqual([
      'com.atproto.server.createSession',
      'app.bsky.actor.getProfile',
    ]);
    expect(calls[1].headers['atproto-proxy']).toBe(
      'did:web:api.bsky.app#bsky_appview',
    );
    expect([...store.data.keys()]).toEqual([
      `bluesky:https://bsky.social|${HANDLE}`,
    ]);
  });

  it('publishes rich text with SDK-detected mention, link and tag facets', async () => {
    const { provider } = setup();
    const { calls } = mockFetch(routes());

    const result = await provider.publish(creds, {
      text: 'Hi @friend.bsky.social see https://example.com #launch',
      idempotencyKey: 'k',
      media: [],
      options: null,
    });

    expect(result.externalId).toBe(
      `at://${DID}/app.bsky.feed.post/3k4duaz5vfs2b`,
    );
    expect(result.externalUrl).toBe(
      `https://bsky.app/profile/${HANDLE}/post/3k4duaz5vfs2b`,
    );
    const create = calls.find(
      (c) => path(c) === 'com.atproto.repo.createRecord',
    )!;
    expect(create.headers['atproto-proxy']).toBeUndefined();
    const record = (
      create.body as { record: { facets: { features: { $type: string }[] }[] } }
    ).record;
    expect(record.facets.map((f) => f.features[0].$type)).toEqual([
      'app.bsky.richtext.facet#mention',
      'app.bsky.richtext.facet#link',
      'app.bsky.richtext.facet#tag',
    ]);
  });

  it('resumes the stored session instead of logging in again', async () => {
    const { provider, store } = setup();
    mockFetch(routes());
    await provider.publish(creds, {
      text: 'first',
      idempotencyKey: '1',
      media: [],
      options: null,
    });

    const second = setup();
    second.store.data.set(...[...store.data.entries()][0]);
    const { calls } = mockFetch(routes());
    await second.provider.publish(creds, {
      text: 'second',
      idempotencyKey: '2',
      media: [],
      options: null,
    });

    expect(calls.map(path)).not.toContain('com.atproto.server.createSession');
    expect(calls.map(path)).toContain('com.atproto.server.refreshSession');
    expect(second.store.save).toHaveBeenCalled();
  });

  it('logs in again when the stored session was revoked', async () => {
    const { provider, store } = setup();
    store.data.set(`bluesky:https://bsky.social|${HANDLE}`, {
      ...sessionBody(),
      service: 'https://bsky.social',
    });
    const { calls } = mockFetch(
      routes({
        [`POST ${PDS}/com.atproto.server.refreshSession`]: () => ({
          status: 400,
          body: { error: 'ExpiredToken', message: 'Token has been revoked' },
        }),
      }),
    );

    await provider.publish(creds, {
      text: 'hello',
      idempotencyKey: 'k',
      media: [],
      options: null,
    });

    expect(calls.map(path)).toContain('com.atproto.server.createSession');
  });

  it('embeds a website card with an uploaded thumbnail for the first link', async () => {
    const { provider, fetchPreview } = setup({
      url: 'https://example.com/menu',
      title: 'Autumn menu',
      description: 'Maple oat latte',
      image: { data: new Uint8Array([1, 2, 3]), mimeType: 'image/jpeg' },
    });
    const { calls } = mockFetch(
      routes({
        [`POST ${PDS}/com.atproto.repo.uploadBlob`]: () => ({
          body: {
            blob: {
              $type: 'blob',
              ref: { $link: BLOB_CID },
              mimeType: 'image/jpeg',
              size: 3,
            },
          },
        }),
      }),
    );

    await provider.publish(creds, {
      text: 'New menu https://example.com/menu',
      idempotencyKey: 'k',
      media: [],
      options: null,
    });

    expect(fetchPreview).toHaveBeenCalledWith('https://example.com/menu');
    const upload = calls.find(
      (c) => path(c) === 'com.atproto.repo.uploadBlob',
    )!;
    expect(upload.headers['content-type']).toBe('image/jpeg');
    const embed = (
      calls.find((c) => path(c) === 'com.atproto.repo.createRecord')!.body as {
        record: {
          embed: { $type: string; external: { uri: string; title: string } };
        };
      }
    ).record.embed;
    expect(embed).toMatchObject({
      $type: 'app.bsky.embed.external',
      external: { uri: 'https://example.com/menu', title: 'Autumn menu' },
    });
  });

  it('reads engagement with getPosts in batches of 25', async () => {
    const { provider } = setup();
    const uris = Array.from(
      { length: 30 },
      (_, i) => `at://${DID}/app.bsky.feed.post/${tid(i)}`,
    );
    const { calls } = mockFetch(
      routes({
        [`GET ${PDS}/app.bsky.feed.getPosts`]: (r) => ({
          body: {
            posts: r.url.searchParams.getAll('uris').map((uri) => ({
              uri,
              cid: BLOB_CID,
              author: { did: DID, handle: HANDLE },
              record: {},
              indexedAt: new Date().toISOString(),
              likeCount: 5,
              repostCount: 2,
              replyCount: 1,
              quoteCount: 0,
            })),
          },
        }),
      }),
    );

    const metrics = await provider.fetchMetrics(creds, uris);

    expect(
      calls
        .filter((c) => path(c) === 'app.bsky.feed.getPosts')
        .map((c) => c.url.searchParams.getAll('uris').length),
    ).toEqual([25, 5]);
    expect(metrics.get(uris[0])).toMatchObject({
      likes: 5,
      reposts: 2,
      replies: 1,
      quotes: 0,
    });
  });

  it('maps rate limits to a retryable error and bad passwords to 401', async () => {
    const { provider } = setup();
    mockFetch(
      routes({
        [`POST ${PDS}/com.atproto.server.createSession`]: () => ({
          status: 429,
          body: { error: 'RateLimitExceeded', message: 'Rate Limit Exceeded' },
        }),
      }),
    );
    await expect(provider.verify(creds)).rejects.toMatchObject({
      status: 429,
      retryable: true,
    });

    vi.unstubAllGlobals();
    mockFetch(
      routes({
        [`POST ${PDS}/com.atproto.server.createSession`]: () => ({
          status: 401,
          body: {
            error: 'AuthenticationRequired',
            message: 'Invalid identifier or password',
          },
        }),
      }),
    );
    const error = await provider.verify(creds).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PlatformApiError);
    expect(error).toMatchObject({ status: 401, retryable: false });
  });

  it('logs the session out on Bluesky when the account is disconnected', async () => {
    const { provider, store } = setup();
    mockFetch(routes());
    await provider.verify(creds);

    const { calls } = mockFetch(routes());
    await provider.disconnect(creds);

    expect(calls.map(path)).toEqual(['com.atproto.server.deleteSession']);
    expect(store.data.size).toBe(0);
  });

  it('rejects a main password in place of an app password', async () => {
    await expect(
      setup().provider.parseCredentials({
        identifier: 'yo',
        appPassword: 'hunter2',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
