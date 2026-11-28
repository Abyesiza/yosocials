import { BadRequestException } from '@nestjs/common';
import { PlatformApiError } from '../../../../common/http/http-client.js';
import {
  mockFetch,
  type RecordedRequest,
} from '../../../../../test/support/mock-fetch.js';
import type { PublishMedia } from '../../interfaces/platform-provider.interface.js';
import { MastodonProvider } from './mastodon.provider.js';

type Route = (r: RecordedRequest) => {
  status?: number;
  body?: unknown;
  raw?: string;
};

const HOST = 'mastodon.social';
const creds = {
  instanceUrl: `https://${HOST}`,
  accessToken: 'x'.repeat(40),
};
const photo = (name: string, size = 300_000): PublishMedia => ({
  kind: 'image',
  url: `https://abysocials.test/media/${name}.jpg`,
  contentType: 'image/jpeg',
  size,
  width: 1200,
  height: 800,
});
const video: PublishMedia = {
  kind: 'video',
  url: 'https://abysocials.test/media/ws_clip.mp4',
  contentType: 'video/mp4',
  size: 5_000_000,
  durationSec: 12,
  width: 1920,
  height: 1080,
};
const status = {
  id: '111',
  url: `https://${HOST}/@yo/111`,
  created_at: '2026-11-28T10:00:00.000Z',
  favourites_count: 0,
  reblogs_count: 0,
  replies_count: 0,
};
const multipartText = (body: unknown) =>
  Buffer.from(body as Uint8Array).toString('latin1');

function routes(extra: Record<string, Route> = {}) {
  let uploads = 0;
  return mockFetch({
    'GET abysocials.test/media/*': (r) => ({
      raw: r.url.pathname.endsWith('.mp4') ? 'video-bytes' : 'jpeg-bytes',
    }),
    [`GET ${HOST}/api/v2/instance`]: () => ({
      body: {
        configuration: {
          statuses: { max_media_attachments: 4 },
          media_attachments: {
            image_size_limit: 16_777_216,
            video_size_limit: 103_809_024,
          },
        },
      },
    }),
    [`POST ${HOST}/api/v2/media`]: () => {
      const id = String(++uploads);
      return { body: { id, type: 'image', url: `https://files/${id}.jpg` } };
    },
    [`POST ${HOST}/api/v1/statuses`]: () => ({ body: status }),
    ...extra,
  });
}

const publish = (media: PublishMedia[], text = 'hi') =>
  new MastodonProvider().publish(creds, {
    text,
    idempotencyKey: 'target-1',
    media,
    options: null,
  });

afterEach(() => vi.unstubAllGlobals());

describe('MastodonProvider media', () => {
  it('uploads photos and posts them with media_ids', async () => {
    const { calls } = routes();

    await publish([photo('ws_a'), photo('ws_b')]);

    const uploads = calls.filter((c) => c.url.pathname === '/api/v2/media');
    expect(uploads).toHaveLength(2);
    expect(uploads[0].headers.authorization).toBe(`Bearer ${'x'.repeat(40)}`);
    expect(multipartText(uploads[0].body)).toMatch(
      /name="file"; filename="ws_a\.jpg"\r\nContent-Type: image\/jpeg\r\n\r\njpeg-bytes/,
    );
    const post = calls.find((c) => c.url.pathname === '/api/v1/statuses')!;
    expect(post.body).toEqual({
      status: 'hi',
      visibility: 'public',
      media_ids: ['1', '2'],
    });
  });

  it('waits while the server processes a video (202, then 206, then 200)', async () => {
    let checks = 0;
    const { calls } = routes({
      [`POST ${HOST}/api/v2/media`]: () => ({
        status: 202,
        body: { id: '77', type: 'video', url: null },
      }),
      [`GET ${HOST}/api/v1/media/77`]: () =>
        ++checks < 2
          ? { status: 206, body: { id: '77', type: 'video', url: null } }
          : { body: { id: '77', type: 'video', url: 'https://files/77.mp4' } },
    });

    await publish([video], '');

    expect(checks).toBe(2);
    const post = calls.find((c) => c.url.pathname === '/api/v1/statuses')!;
    expect(post.body).toEqual({
      status: '',
      visibility: 'public',
      media_ids: ['77'],
    });
  });

  it('explains a processing error and posts nothing', async () => {
    const { calls } = routes({
      [`POST ${HOST}/api/v2/media`]: () => ({
        status: 202,
        body: { id: '78', type: 'video', url: null },
      }),
      [`GET ${HOST}/api/v1/media/78`]: () => ({
        status: 422,
        body: { error: 'Error processing thumbnail for uploaded media' },
      }),
    });

    const error = await publish([video]).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(PlatformApiError);
    expect(error).toMatchObject({
      message:
        'Your Mastodon server couldn’t process this media. Try a different file.',
      retryable: false,
    });
    expect(calls.map((c) => c.url.pathname)).not.toContain('/api/v1/statuses');
  });

  it('asks for a new token when the old one can’t upload media', async () => {
    routes({
      [`POST ${HOST}/api/v2/media`]: () => ({
        status: 403,
        body: { error: 'This action is outside the authorized scopes' },
      }),
    });

    await expect(publish([photo('ws_a')])).rejects.toMatchObject({
      status: 403,
      message: expect.stringContaining('with write:media ticked as well'),
    });
  });

  it('checks the server’s own limits before uploading', async () => {
    const { calls } = routes({
      [`GET ${HOST}/api/v2/instance`]: () => ({
        body: {
          configuration: {
            media_attachments: { video_size_limit: 4 * 1024 * 1024 },
          },
        },
      }),
    });

    await expect(publish([video])).rejects.toThrow(
      'To post to Mastodon, use a video up to 4 MB. That’s the most your Mastodon server takes.',
    );
    expect(calls.map((c) => c.url.pathname)).not.toContain('/api/v2/media');
  });

  it('refuses media outside Mastodon’s defaults without calling the server', async () => {
    const { calls } = routes();

    await expect(
      publish(['a', 'b', 'c', 'd', 'e'].map((n) => photo(n))),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      publish([{ ...video, width: 4096, height: 2160 }]),
    ).rejects.toThrow(/use a smaller video/);
    expect(calls).toHaveLength(0);
  });
});
