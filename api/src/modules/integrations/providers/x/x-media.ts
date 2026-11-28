import { Injectable } from '@nestjs/common';
import { PlatformApiError } from '../../../../common/http/http-client.js';
import type { PublishMedia } from '../../interfaces/platform-provider.interface.js';
import { XApi } from './x-api.js';
import type { XUploadedMedia } from './x.types.js';

/** Under X's 5 MB recommendation (8 MB max) per APPEND segment. */
const CHUNK_BYTES = 4 * 1024 * 1024;
/** Stay well inside publishing's 10-minute stuck window. */
const MAX_PROCESSING_MS = 5 * 60_000;
const DOWNLOAD_TIMEOUT_MS = 5 * 60_000;

/**
 * Uploads a post's media to X. X can't pull from a URL, so files are read
 * from our media URL and sent on: images in one request, videos streamed in
 * chunks (INIT → APPEND → FINALIZE), then waited on until X has processed them.
 */
@Injectable()
export class XMediaUploader {
  constructor(private readonly api: XApi) {}

  async upload(userId: string, media: PublishMedia[]): Promise<string[]> {
    const ids: string[] = [];
    for (const item of media) {
      ids.push(
        item.kind === 'image'
          ? await this.uploadImage(userId, item)
          : await this.uploadVideo(userId, item),
      );
    }
    return ids;
  }

  private async uploadImage(
    userId: string,
    item: PublishMedia,
  ): Promise<string> {
    const res = await download(item.url);
    const form = new FormData();
    form.append('media_category', 'tweet_image');
    form.append(
      'media',
      new Blob([await res.arrayBuffer()], { type: item.contentType }),
    );
    const { data } = await this.api.call<XUploadedMedia>(
      userId,
      '/2/media/upload',
      {
        method: 'POST',
        multipart: form,
        timeoutMs: 120_000,
      },
    );
    return this.processed(userId, data!);
  }

  private async uploadVideo(
    userId: string,
    item: PublishMedia,
  ): Promise<string> {
    const res = await download(item.url);
    const totalBytes = Number(res.headers.get('content-length')) || item.size;
    const { data: init } = await this.api.call<XUploadedMedia>(
      userId,
      '/2/media/upload/initialize',
      {
        json: {
          media_type: item.contentType,
          total_bytes: totalBytes,
          media_category: 'tweet_video',
        },
      },
    );
    const id = init!.id;

    let index = 0;
    for await (const chunk of chunks(res, CHUNK_BYTES)) {
      const form = new FormData();
      form.append('segment_index', String(index++));
      form.append(
        'media',
        new Blob([chunk], { type: 'application/octet-stream' }),
      );
      await this.api.call(userId, `/2/media/upload/${id}/append`, {
        method: 'POST',
        multipart: form,
        timeoutMs: 120_000,
      });
    }

    const { data } = await this.api.call<XUploadedMedia>(
      userId,
      `/2/media/upload/${id}/finalize`,
      { method: 'POST' },
    );
    return this.processed(userId, data!);
  }

  /** Waits until X has processed the media, following its check_after_secs hints. */
  private async processed(
    userId: string,
    media: XUploadedMedia,
  ): Promise<string> {
    const deadline = Date.now() + MAX_PROCESSING_MS;
    let info = media.processing_info;
    while (info && info.state !== 'succeeded') {
      if (info.state === 'failed') {
        throw new PlatformApiError(
          'X couldn’t process this media. Check the format (MP4 with H.264 video and AAC audio works best) and try again.',
          422,
          false,
        );
      }
      if (Date.now() > deadline) {
        throw new PlatformApiError(
          'X took too long to process the video. Try again.',
          504,
          true,
        );
      }
      await sleep((info.check_after_secs ?? 2) * 1000);
      const { data } = await this.api.call<XUploadedMedia>(
        userId,
        '/2/media/upload',
        {
          query: { media_id: media.id, command: 'STATUS' },
        },
      );
      info = data?.processing_info;
    }
    return media.id;
  }
}

async function download(url: string): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, {
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new PlatformApiError(
      `Couldn’t read the media to send to X: ${reason}`,
      0,
      true,
    );
  }
  if (!res.ok || !res.body) {
    throw new PlatformApiError(
      `Couldn’t read the media to send to X (${res.status})`,
      res.status >= 500 ? 502 : 422,
      res.status >= 500,
    );
  }
  return res;
}

/** Re-chunks a download into fixed-size pieces without holding the whole file. */
async function* chunks(
  res: Response,
  size: number,
): AsyncGenerator<Buffer<ArrayBuffer>> {
  let parts: Uint8Array[] = [];
  let length = 0;
  for await (const part of res.body!) {
    parts.push(part);
    length += part.length;
    while (length >= size) {
      const joined = Buffer.concat(parts, length);
      yield joined.subarray(0, size);
      parts = [joined.subarray(size)];
      length -= size;
    }
  }
  if (length > 0) yield Buffer.concat(parts, length);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
