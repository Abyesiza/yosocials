import { PlatformApiError } from '../../../common/http/http-client.js';
import { mockFetch } from '../../../../test/support/mock-fetch.js';
import { DiscordProvider } from './discord/discord.provider.js';
import { MastodonProvider } from './mastodon/mastodon.provider.js';
import { TelegramProvider } from './telegram/telegram.provider.js';

afterEach(() => vi.unstubAllGlobals());

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
