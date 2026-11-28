import { mockFetch, type RecordedRequest } from './support/mock-fetch.js';
import {
  signUp,
  startTestApp,
  type SignedUp,
  type TestApp,
} from './support/test-app.js';

/**
 * Photos and videos on Telegram (Bot API multipart uploads) and Discord
 * (webhook attachments), end to end. Both platforms and our media URLs are
 * stubbed (shapes per core.telegram.org/bots/api and discord.com/developers/docs).
 */

const MEDIA = 'abysocials.test';
const BOT_TOKEN = `123456789:${'A'.repeat(35)}`;
const BOT = `api.telegram.org/bot${BOT_TOKEN}`;
const WEBHOOK_PATH = `/api/webhooks/123456789012345678/${'t'.repeat(60)}`;
const WEBHOOK_URL = `https://discord.com${WEBHOOK_PATH}`;

let t: TestApp;
let owner: SignedUp;
let telegramId: string;
let discordId: string;
let calls: RecordedRequest[];

const api = {
  get: (path: string) =>
    t.http.get(`/api/workspaces/${owner.workspaceId}${path}`).set(owner.auth),
  post: (path: string) =>
    t.http.post(`/api/workspaces/${owner.workspaceId}${path}`).set(owner.auth),
};

const sent = (path: string) =>
  calls.filter((c) => `${c.url.host}${c.url.pathname}` === path);
const multipartText = (c: RecordedRequest) =>
  Buffer.from(c.body as Uint8Array).toString('latin1');
const field = (c: RecordedRequest, name: string) =>
  multipartText(c).match(new RegExp(`name="${name}"\r\n\r\n([^\r]*)`))?.[1];

const telegramMessage = (id: number) => ({
  message_id: id,
  date: 1_790_000_000,
  chat: { id: -1001, type: 'channel', title: 'Aby', username: 'abysocials' },
});

function stub() {
  const mock = mockFetch({
    [`GET ${MEDIA}/media/*`]: (req) => ({
      raw: `bytes-of-${req.url.pathname.split('/').pop()}`,
    }),
    [`POST ${BOT}/getMe`]: () => ({
      body: {
        ok: true,
        result: { id: 9, is_bot: true, username: 'aby_bot', first_name: 'Aby' },
      },
    }),
    [`POST ${BOT}/getChat`]: () => ({
      body: { ok: true, result: telegramMessage(0).chat },
    }),
    [`POST ${BOT}/getChatMember`]: () => ({
      body: {
        ok: true,
        result: { status: 'administrator', can_post_messages: true },
      },
    }),
    [`POST ${BOT}/sendPhoto`]: () => ({
      body: { ok: true, result: telegramMessage(41) },
    }),
    [`POST ${BOT}/sendVideo`]: () => ({
      body: { ok: true, result: telegramMessage(42) },
    }),
    [`POST ${BOT}/sendMediaGroup`]: () => ({
      body: { ok: true, result: [telegramMessage(43), telegramMessage(44)] },
    }),
    [`GET discord.com${WEBHOOK_PATH}`]: () => ({
      body: {
        id: '123456789012345678',
        name: 'Aby',
        channel_id: '55',
        guild_id: '77',
        avatar: null,
      },
    }),
    [`POST discord.com${WEBHOOK_PATH}`]: () => ({
      body: {
        id: '999',
        channel_id: '55',
        timestamp: '2026-11-28T10:00:00.000Z',
      },
    }),
  });
  calls = mock.calls;
}

interface Attached {
  path: string;
  contentType: string;
  size: number;
  width?: number;
  height?: number;
  durationSec?: number;
}

async function upload(
  contentType: string,
  extra: Partial<Attached> = {},
): Promise<Attached> {
  const size = extra.size ?? 300_000;
  const res = await api
    .post('/media/uploads')
    .send({ files: [{ contentType, size }] })
    .expect(201);
  const [path] = res.body.customIds as string[];
  return { path, contentType, size, ...extra };
}

async function draft(accountId: string, body: string, media: Attached[]) {
  const post = await api
    .post('/posts')
    .send({ body, media, targets: [{ accountId }] })
    .expect(201);
  return post.body as { id: string };
}

async function publish(accountId: string, body: string, media: Attached[]) {
  const post = await draft(accountId, body, media);
  const outcomes = await api.post(`/posts/${post.id}/publish`).expect(200);
  return { post, outcome: outcomes.body[0] };
}

beforeAll(async () => {
  t = await startTestApp();
  owner = await signUp(t.http, 'Media owner');
}, 60_000);

beforeEach(() => stub());
afterEach(() => vi.unstubAllGlobals());
afterAll(() => t?.close());

describe('Telegram and Discord media', () => {
  it('lists the media each platform takes', async () => {
    const res = await t.http.get('/api/integrations').expect(200);
    const find = (platform: string) =>
      res.body.find((p: { platform: string }) => p.platform === platform);
    expect(find('telegram').media).toMatchObject({
      video: true,
      maxImages: 10,
      imageSpec: { maxBytes: 10_000_000, maxSideSum: 10000 },
      videoSpec: { maxBytes: 50_000_000 },
    });
    expect(find('discord').media).toMatchObject({
      video: true,
      maxImages: 10,
      imageSpec: { maxBytes: 2_400_000 },
      videoSpec: { maxBytes: 20_000_000 },
    });
  });

  it('connects a Telegram channel and a Discord webhook', async () => {
    telegramId = (
      await api
        .post('/accounts')
        .send({
          platform: 'telegram',
          credentials: { botToken: BOT_TOKEN, chatId: '@abysocials' },
        })
        .expect(201)
    ).body.id;
    discordId = (
      await api
        .post('/accounts')
        .send({ platform: 'discord', credentials: { webhookUrl: WEBHOOK_URL } })
        .expect(201)
    ).body.id;
  });

  it('uploads one photo to Telegram with the text as its caption', async () => {
    const photo = await upload('image/jpeg', { width: 1200, height: 800 });
    const { post, outcome } = await publish(telegramId, 'Hello', [photo]);
    expect(outcome.status).toBe('published');

    const [req] = sent(`${BOT}/sendPhoto`);
    expect(field(req, 'chat_id')).toBe('@abysocials');
    expect(field(req, 'caption')).toBe('Hello');
    expect(multipartText(req)).toContain(`bytes-of-${photo.path}`);
    const target = (await api.get(`/posts/${post.id}`)).body.targets[0];
    expect(target.externalUrl).toBe('https://t.me/abysocials/41');
  });

  it('sends several photos to Telegram as one album', async () => {
    const photos = [
      await upload('image/jpeg', { width: 1200, height: 800 }),
      await upload('image/webp', { width: 800, height: 800 }),
    ];
    const { post, outcome } = await publish(telegramId, 'Album', photos);
    expect(outcome.status).toBe('published');

    const [req] = sent(`${BOT}/sendMediaGroup`);
    expect(JSON.parse(field(req, 'media')!)).toEqual([
      { type: 'photo', media: 'attach://photo0', caption: 'Album' },
      { type: 'photo', media: 'attach://photo1' },
    ]);
    expect(multipartText(req)).toContain(
      `name="photo1"; filename="${photos[1].path}"`,
    );
    const target = (await api.get(`/posts/${post.id}`)).body.targets[0];
    expect(target.externalUrl).toBe('https://t.me/abysocials/43');
  });

  it('sends a video to Telegram with its size and length', async () => {
    const video = await upload('video/mp4', {
      size: 8_000_000,
      width: 1080,
      height: 1920,
      durationSec: 14.2,
    });
    const { outcome } = await publish(telegramId, 'Watch', [video]);
    expect(outcome.status).toBe('published');

    const [req] = sent(`${BOT}/sendVideo`);
    expect(field(req, 'width')).toBe('1080');
    expect(field(req, 'height')).toBe('1920');
    expect(field(req, 'duration')).toBe('14');
    expect(field(req, 'supports_streaming')).toBe('true');
    expect(multipartText(req)).toContain(`bytes-of-${video.path}`);
  });

  it('refuses a Telegram caption over 1,024 characters', async () => {
    const photo = await upload('image/jpeg');
    const post = await draft(telegramId, 'x'.repeat(1025), [photo]);
    const res = await api.post(`/posts/${post.id}/publish`).expect(400);
    expect(res.body.message).toEqual([
      'To post to @abysocials on Telegram, keep the text to 1,024 characters when posting photos or videos to Telegram, or remove the media.',
    ]);
    expect(sent(`${BOT}/sendPhoto`)).toHaveLength(0);
  });

  it('attaches several photos to one Discord message', async () => {
    const photos = [
      await upload('image/jpeg', { width: 1200, height: 800 }),
      await upload('image/jpeg', { width: 800, height: 1200 }),
    ];
    const { post, outcome } = await publish(discordId, 'Look', photos);
    expect(outcome.status).toBe('published');

    const [req] = sent(`discord.com${WEBHOOK_PATH}`).filter(
      (c) => c.method === 'POST',
    );
    expect(req.url.searchParams.get('wait')).toBe('true');
    expect(JSON.parse(field(req, 'payload_json')!)).toEqual({
      content: 'Look',
      allowed_mentions: { parse: [] },
      attachments: photos.map((p, id) => ({ id, filename: p.path })),
    });
    expect(multipartText(req)).toContain(
      `name="files[1]"; filename="${photos[1].path}"`,
    );
    const target = (await api.get(`/posts/${post.id}`)).body.targets[0];
    expect(target.externalUrl).toBe('https://discord.com/channels/77/55/999');
  });

  it('refuses Discord files over 25 MB in total', async () => {
    const video = await upload('video/mp4', { size: 26 * 1024 * 1024 });
    const post = await draft(discordId, 'Big', [video]);
    const res = await api.post(`/posts/${post.id}/publish`).expect(400);
    expect(res.body.message).toContain(
      'To post to #55 on Discord, keep the photos and videos to 25 MB in total. Remove some, or use smaller ones.',
    );
    expect(sent(`discord.com${WEBHOOK_PATH}`)).toHaveLength(0);
  });
});
