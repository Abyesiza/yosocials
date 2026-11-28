import { PlatformApiError } from '../../../common/http/http-client.js';
import { mockFetch } from '../../../../test/support/mock-fetch.js';
import { DiscordProvider } from './discord/discord.provider.js';
import { MastodonProvider } from './mastodon/mastodon.provider.js';
import type { PublishMedia } from '../interfaces/platform-provider.interface.js';
import { TelegramProvider } from './telegram/telegram.provider.js';

afterEach(() => vi.unstubAllGlobals());

const photo = (name: string, size = 300_000): PublishMedia => ({
  kind: 'image',
  url: `https://abysocials.test/media/${name}.jpg`,
  contentType: 'image/jpeg',
  size,
  width: 1200,
  height: 800,
});
const multipartText = (body: unknown) =>
  Buffer.from(body as Uint8Array).toString('latin1');
/** The value of a text field in a multipart body. */
const field = (body: unknown, name: string) =>
  multipartText(body).match(new RegExp(`name="${name}"\r\n\r\n([^\r]*)`))?.[1];

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
      media: [],
      options: null,
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
      /an admin of the channel/,
    );
  });

  describe('publishing media', () => {
    const bot = `api.telegram.org/bot${creds.botToken}`;
    const message = (id: number) => ({
      message_id: id,
      date: 1_790_000_000,
      chat: { id: -100, type: 'channel', username: 'yosocials' },
    });
    const send = (media: PublishMedia[], text = 'Hello') =>
      new TelegramProvider().publish(creds, {
        text,
        idempotencyKey: 'k',
        media,
        options: null,
      });
    const stub = () =>
      mockFetch({
        'GET abysocials.test/media/*': (req) => ({
          raw: `bytes-of-${req.url.pathname.split('/').pop()}`,
        }),
        [`POST ${bot}/sendPhoto`]: () => ({
          body: { ok: true, result: message(41) },
        }),
        [`POST ${bot}/sendVideo`]: () => ({
          body: { ok: true, result: message(42) },
        }),
        [`POST ${bot}/sendMediaGroup`]: () => ({
          body: { ok: true, result: [message(43), message(44)] },
        }),
      });

    it('uploads one photo with the text as its caption', async () => {
      const { calls } = stub();
      const result = await send([photo('a')]);
      const [req] = calls.filter((c) => c.url.pathname.endsWith('/sendPhoto'));
      expect(field(req.body, 'chat_id')).toBe('@yosocials');
      expect(field(req.body, 'caption')).toBe('Hello');
      expect(multipartText(req.body)).toMatch(
        /name="photo"; filename="a\.jpg"\r\nContent-Type: image\/jpeg\r\n\r\nbytes-of-a\.jpg/,
      );
      expect(result).toMatchObject({
        externalId: '-100:41',
        externalUrl: 'https://t.me/yosocials/41',
      });
    });

    it('sends several photos as an album, captioned on the first', async () => {
      const { calls } = stub();
      const result = await send([photo('a'), photo('b')]);
      const [req] = calls.filter((c) =>
        c.url.pathname.endsWith('/sendMediaGroup'),
      );
      expect(JSON.parse(field(req.body, 'media')!)).toEqual([
        { type: 'photo', media: 'attach://photo0', caption: 'Hello' },
        { type: 'photo', media: 'attach://photo1' },
      ]);
      expect(multipartText(req.body)).toContain('bytes-of-a.jpg');
      expect(multipartText(req.body)).toContain('bytes-of-b.jpg');
      expect(result.externalId).toBe('-100:43');
    });

    it('sends a video with its size, length and streaming', async () => {
      const { calls } = stub();
      await send([
        {
          kind: 'video',
          url: 'https://abysocials.test/media/v.mp4',
          contentType: 'video/mp4',
          size: 5_000_000,
          durationSec: 12.6,
          width: 1080,
          height: 1920,
        },
      ]);
      const [req] = calls.filter((c) => c.url.pathname.endsWith('/sendVideo'));
      expect(field(req.body, 'width')).toBe('1080');
      expect(field(req.body, 'height')).toBe('1920');
      expect(field(req.body, 'duration')).toBe('13');
      expect(field(req.body, 'supports_streaming')).toBe('true');
      expect(multipartText(req.body)).toContain('bytes-of-v.mp4');
    });

    it('keeps captions to 1,024 characters', async () => {
      const telegram = new TelegramProvider();
      expect(
        telegram.readinessIssues({
          text: 'x'.repeat(1025),
          media: [photo('a')],
          options: null,
        }),
      ).toEqual([
        'keep the text to 1,024 characters when posting photos or videos to Telegram, or remove the media.',
      ]);
      expect(
        telegram.readinessIssues({
          text: 'x'.repeat(4000),
          media: [],
          options: null,
        }),
      ).toEqual([]);
      const { calls } = stub();
      await expect(send([photo('a')], 'x'.repeat(1025))).rejects.toThrow(
        /^To post to Telegram, keep the text to 1,024 characters/,
      );
      expect(calls).toHaveLength(0);
    });
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
      { text: '@everyone hi', idempotencyKey: 'k', media: [], options: null },
    );
    expect(calls[0].url.searchParams.get('wait')).toBe('true');
    expect(calls[0].body).toEqual({
      content: '@everyone hi',
      allowed_mentions: { parse: [] },
    });
    expect(result.externalUrl).toBe('https://discord.com/channels/77/55/999');
  });

  it('attaches several files to one message', async () => {
    const { calls } = mockFetch({
      'GET abysocials.test/media/*': (req) => ({
        raw: `bytes-of-${req.url.pathname.split('/').pop()}`,
      }),
      [`POST discord.com${path}`]: () => ({
        body: {
          id: '1000',
          channel_id: '55',
          timestamp: '2026-11-19T10:00:00.000Z',
        },
      }),
      [`GET discord.com${path}`]: () => ({
        body: { id: '1', name: 'Yo', channel_id: '55', guild_id: '77' },
      }),
    });
    const result = await new DiscordProvider().publish(
      { webhookUrl },
      {
        text: 'Look',
        idempotencyKey: 'k',
        media: [photo('a'), photo('b')],
        options: null,
      },
    );
    const [req] = calls.filter((c) => c.method === 'POST');
    expect(req.url.searchParams.get('wait')).toBe('true');
    expect(JSON.parse(field(req.body, 'payload_json')!)).toEqual({
      content: 'Look',
      allowed_mentions: { parse: [] },
      attachments: [
        { id: 0, filename: 'a.jpg' },
        { id: 1, filename: 'b.jpg' },
      ],
    });
    expect(multipartText(req.body)).toMatch(
      /name="files\[0\]"; filename="a\.jpg"\r\nContent-Type: image\/jpeg\r\n\r\nbytes-of-a\.jpg/,
    );
    expect(multipartText(req.body)).toContain(
      'name="files[1]"; filename="b.jpg"',
    );
    expect(result.externalUrl).toBe('https://discord.com/channels/77/55/1000');
  });

  it('keeps a message’s files to 25 MB in total', async () => {
    const discord = new DiscordProvider();
    const video = (size: number): PublishMedia => ({
      kind: 'video',
      url: 'https://abysocials.test/media/v.mp4',
      contentType: 'video/mp4',
      size,
    });
    expect(
      discord.readinessIssues({
        text: 'hi',
        media: [video(26 * 1024 * 1024)],
        options: null,
      }),
    ).toEqual([
      'keep the photos and videos to 25 MB in total. Remove some, or use smaller ones.',
    ]);
    expect(
      discord.readinessIssues({
        text: 'hi',
        media: Array.from({ length: 10 }, (_, i) => photo(`p${i}`, 2_400_000)),
        options: null,
      }),
    ).toEqual([]);
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
