import { BadRequestException } from '@nestjs/common';
import { PlatformApiError } from '../../../common/http/http-client.js';
import { mockFetch } from '../../../../test/support/mock-fetch.js';
import { BlueskyProvider } from './bluesky/bluesky.provider.js';
import { DiscordProvider } from './discord/discord.provider.js';
import { MastodonProvider } from './mastodon/mastodon.provider.js';
import { TelegramProvider } from './telegram/telegram.provider.js';

afterEach(() => vi.unstubAllGlobals());

describe('BlueskyProvider', () => {
  const creds = {
    identifier: 'yo.bsky.social',
    appPassword: 'abcd-efgh-ijkl-mnop',
  };
  const session = {
    did: 'did:plc:abc',
    handle: 'yo.bsky.social',
    accessJwt: 'jwt',
    refreshJwt: 'r',
  };

  it('creates a post record with facets and builds its URL', async () => {
    const { calls } = mockFetch({
      'POST bsky.social/xrpc/com.atproto.server.createSession': () => ({
        body: session,
      }),
      'POST bsky.social/xrpc/com.atproto.repo.createRecord': () => ({
        body: { uri: 'at://did:plc:abc/app.bsky.feed.post/3kxyz', cid: 'c' },
      }),
    });

    const result = await new BlueskyProvider().publish(creds, {
      text: 'Hello #yosocials',
      idempotencyKey: 'k',
    });

    expect(result.externalId).toBe('at://did:plc:abc/app.bsky.feed.post/3kxyz');
    expect(result.externalUrl).toBe(
      'https://bsky.app/profile/yo.bsky.social/post/3kxyz',
    );
    const create = calls[1];
    expect(create.headers.authorization).toBe('Bearer jwt');
    expect(create.body).toMatchObject({
      repo: 'did:plc:abc',
      collection: 'app.bsky.feed.post',
      record: {
        text: 'Hello #yosocials',
        facets: [{ features: [{ tag: 'yosocials' }] }],
      },
    });
  });

  it('reuses the session across publishes', async () => {
    const { calls } = mockFetch({
      'POST bsky.social/xrpc/com.atproto.server.createSession': () => ({
        body: session,
      }),
      'POST bsky.social/xrpc/com.atproto.repo.createRecord': () => ({
        body: { uri: 'at://x/app.bsky.feed.post/1', cid: 'c' },
      }),
    });
    const provider = new BlueskyProvider();
    await provider.publish(creds, { text: 'a', idempotencyKey: '1' });
    await provider.publish(creds, { text: 'b', idempotencyKey: '2' });
    expect(
      calls.filter((c) => c.url.pathname.endsWith('createSession')),
    ).toHaveLength(1);
  });

  it('maps getPosts counts to metrics', async () => {
    mockFetch({
      'GET public.api.bsky.app/xrpc/app.bsky.feed.getPosts': (req) => {
        expect(req.url.searchParams.getAll('uris')).toEqual([
          'at://1',
          'at://2',
        ]);
        return {
          body: {
            posts: [
              {
                uri: 'at://1',
                cid: 'a',
                likeCount: 5,
                repostCount: 2,
                replyCount: 1,
                quoteCount: 0,
              },
              { uri: 'at://2', cid: 'b', likeCount: 0 },
            ],
          },
        };
      },
    });
    const metrics = await new BlueskyProvider().fetchMetrics(creds, [
      'at://1',
      'at://2',
    ]);
    expect(metrics.get('at://1')).toMatchObject({
      likes: 5,
      reposts: 2,
      replies: 1,
      quotes: 0,
    });
    expect(metrics.get('at://2')?.reposts).toBeUndefined();
  });

  it('rejects a main password in place of an app password', async () => {
    await expect(
      new BlueskyProvider().parseCredentials({
        identifier: 'yo',
        appPassword: 'hunter2',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('MastodonProvider', () => {
  const creds = {
    instanceUrl: 'https://mastodon.social',
    accessToken: 'x'.repeat(40),
  };

  it('sends an idempotency key and returns the status URL', async () => {
    const { calls } = mockFetch({
      'POST mastodon.social/api/v1/statuses': () => ({
        body: {
          id: '111',
          url: 'https://mastodon.social/@yo/111',
          created_at: '2026-11-19T10:00:00.000Z',
          favourites_count: 0,
          reblogs_count: 0,
          replies_count: 0,
        },
      }),
    });
    const result = await new MastodonProvider().publish(creds, {
      text: 'hi',
      idempotencyKey: 'target-1',
    });
    expect(calls[0].headers['idempotency-key']).toBe('target-1');
    expect(calls[0].body).toEqual({ status: 'hi', visibility: 'public' });
    expect(result).toMatchObject({
      externalId: '111',
      externalUrl: 'https://mastodon.social/@yo/111',
    });
  });

  it('turns API errors into PlatformApiError with the platform message', async () => {
    mockFetch({
      'GET mastodon.social/api/v1/accounts/verify_credentials': () => ({
        status: 401,
        body: { error: 'The access token is invalid' },
      }),
    });
    const error = await new MastodonProvider()
      .verify(creds)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PlatformApiError);
    expect(error).toMatchObject({
      status: 401,
      retryable: false,
      message: 'The access token is invalid',
    });
  });
});

describe('TelegramProvider', () => {
  const creds = { botToken: `123456:${'A'.repeat(35)}`, chatId: '@yosocials' };
  const routes = (status: string, canPost?: boolean) => ({
    [`POST api.telegram.org/bot${creds.botToken}/getMe`]: () => ({
      body: {
        ok: true,
        result: { id: 9, is_bot: true, username: 'yo_bot', first_name: 'Yo' },
      },
    }),
    [`POST api.telegram.org/bot${creds.botToken}/getChat`]: () => ({
      body: {
        ok: true,
        result: {
          id: -100,
          type: 'channel',
          title: 'Yo',
          username: 'yosocials',
        },
      },
    }),
    [`POST api.telegram.org/bot${creds.botToken}/getChatMember`]: () => ({
      body: { ok: true, result: { status, can_post_messages: canPost } },
    }),
  });

  it('verifies a bot that can post', async () => {
    mockFetch(routes('administrator', true));
    await expect(new TelegramProvider().verify(creds)).resolves.toMatchObject({
      externalId: '-100',
      handle: '@yosocials',
      profileUrl: 'https://t.me/yosocials',
    });
  });

  it('rejects a bot that is not a channel admin', async () => {
    mockFetch(routes('member'));
    await expect(new TelegramProvider().verify(creds)).rejects.toThrow(
      /must be an admin/,
    );
  });
});

describe('DiscordProvider', () => {
  const webhookUrl = `https://discord.com/api/webhooks/123456789012345678/${'t'.repeat(60)}`;
  const path = new URL(webhookUrl).pathname;

  it('posts with wait=true, blocks mass mentions, and links the message', async () => {
    const { calls } = mockFetch({
      [`POST discord.com${path}`]: () => ({
        body: {
          id: '999',
          channel_id: '55',
          timestamp: '2026-11-19T10:00:00.000Z',
        },
      }),
      [`GET discord.com${path}`]: () => ({
        body: {
          id: '1',
          name: 'Yo',
          channel_id: '55',
          guild_id: '77',
          avatar: null,
        },
      }),
    });
    const result = await new DiscordProvider().publish(
      { webhookUrl },
      { text: '@everyone hi', idempotencyKey: 'k' },
    );
    expect(calls[0].url.searchParams.get('wait')).toBe('true');
    expect(calls[0].body).toEqual({
      content: '@everyone hi',
      allowed_mentions: { parse: [] },
    });
    expect(result.externalUrl).toBe('https://discord.com/channels/77/55/999');
  });

  it('sums reactions into likes', async () => {
    mockFetch({
      [`GET discord.com${path}/messages/999`]: () => ({
        body: {
          id: '999',
          channel_id: '55',
          timestamp: 'x',
          reactions: [
            { count: 3, emoji: { id: null, name: '🔥' } },
            { count: 2, emoji: { id: null, name: '👍' } },
          ],
        },
      }),
    });
    const metrics = await new DiscordProvider().fetchMetrics({ webhookUrl }, [
      '999',
    ]);
    expect(metrics.get('999')?.likes).toBe(5);
  });
});
