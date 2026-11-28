import { Injectable } from '@nestjs/common';
import {
  PlatformApiError,
  requestWithHeaders,
} from '../../../../common/http/http-client.js';
import type { PublishMedia } from '../../interfaces/platform-provider.interface.js';
import { LinkedInApi } from './linkedin-api.js';
import type {
  LinkedInImageUpload,
  LinkedInVideo,
  LinkedInVideoUpload,
} from './linkedin.types.js';

/** Stay well inside publishing's 10-minute stuck window. */
const MAX_PROCESSING_MS = 4 * 60_000;
const POLL_MS = 3_000;
const DOWNLOAD_TIMEOUT_MS = 5 * 60_000;
const UPLOAD_TIMEOUT_MS = 120_000;

/**
 * Uploads a post's media to LinkedIn (Images and Videos APIs). LinkedIn can't
 * pull from a URL, so files are read from our media URL and PUT to the signed
 * upload URLs LinkedIn hands out; videos go up in the parts it asks for.
 */
@Injectable()
export class LinkedInMediaUploader {
  constructor(private readonly api: LinkedInApi) {}

  async upload(memberId: string, media: PublishMedia[]): Promise<string[]> {
    const owner = `urn:li:person:${memberId}`;
    const urns: string[] = [];
    for (const item of media) {
      urns.push(
        item.kind === 'image'
          ? await this.uploadImage(memberId, owner, item)
          : await this.uploadVideo(memberId, owner, item),
      );
    }
    return urns;
  }

  private async uploadImage(
    memberId: string,
    owner: string,
    item: PublishMedia,
  ): Promise<string> {
    const { body } = await this.api.call<LinkedInImageUpload>(
      memberId,
      '/rest/images?action=initializeUpload',
      { json: { initializeUploadRequest: { owner } } },
    );
    const bytes = await (await download(item.url)).blob();
    await this.put(
      body.value.uploadUrl,
      bytes,
      item.contentType,
      await this.api.accessToken(memberId),
    );
    // Tokens with only w_member_social can't read images back; LinkedIn finishes them on its own.
    return body.value.image;
  }

  private async uploadVideo(
    memberId: string,
    owner: string,
    item: PublishMedia,
  ): Promise<string> {
    const res = await download(item.url);
    const size = Number(res.headers.get('content-length')) || item.size;
    const { body } = await this.api.call<LinkedInVideoUpload>(
      memberId,
      '/rest/videos?action=initializeUpload',
      {
        json: {
          initializeUploadRequest: {
            owner,
            fileSizeBytes: size,
            uploadCaptions: false,
            uploadThumbnail: false,
          },
        },
      },
    );
    const { video, uploadToken, uploadInstructions } = body.value;

    const uploadedPartIds: string[] = [];
    const reader = new PartReader(res.body!);
    for (const part of uploadInstructions) {
      const bytes = await reader.read(part.lastByte - part.firstByte + 1);
      const headers = await this.put(
        part.uploadUrl,
        new Blob([bytes]),
        'application/octet-stream',
      );
      const etag = headers.get('etag');
      if (!etag) {
        throw new PlatformApiError(
          'LinkedIn didn’t confirm part of the video upload. Try again.',
          502,
          true,
        );
      }
      uploadedPartIds.push(etag);
    }

    await this.api.call(memberId, '/rest/videos?action=finalizeUpload', {
      json: { finalizeUploadRequest: { video, uploadToken, uploadedPartIds } },
    });
    await this.processed(memberId, video);
    return video;
  }

  /** Waits for the video to be ready. If LinkedIn won't let us check, the post goes out and LinkedIn publishes it once ready. */
  private async processed(memberId: string, urn: string): Promise<void> {
    const deadline = Date.now() + MAX_PROCESSING_MS;
    for (;;) {
      let video: LinkedInVideo;
      try {
        ({ body: video } = await this.api.call<LinkedInVideo>(
          memberId,
          `/rest/videos/${encodeURIComponent(urn)}`,
        ));
      } catch (error) {
        if (error instanceof PlatformApiError && error.status === 403) return;
        throw error;
      }
      if (video.status === 'AVAILABLE') return;
      if (video.status === 'PROCESSING_FAILED') {
        throw new PlatformApiError(
          'LinkedIn couldn’t process this video. Use an MP4 between 3 seconds and 30 minutes long, then try again.',
          422,
          false,
          { reason: video.processingFailureReason },
        );
      }
      if (Date.now() > deadline) return;
      await sleep(POLL_MS);
    }
  }

  private async put(
    url: string,
    data: Blob,
    contentType: string,
    accessToken?: string,
  ): Promise<Headers> {
    const { headers } = await requestWithHeaders(url, {
      method: 'PUT',
      binary: { data, contentType },
      headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
      timeoutMs: UPLOAD_TIMEOUT_MS,
    }).catch((error: unknown) => {
      if (error instanceof PlatformApiError && error.status !== 0) {
        throw new PlatformApiError(
          'LinkedIn didn’t accept the media upload. Try again in a moment.',
          error.status,
          error.status >= 500 || error.status === 429,
          error.body,
        );
      }
      throw error;
    });
    return headers;
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
      'We couldn’t read the media to send to LinkedIn. Try again in a moment.',
      0,
      true,
      { reason },
    );
  }
  if (!res.ok) {
    throw new PlatformApiError(
      res.status >= 500
        ? 'We couldn’t read the media to send to LinkedIn. Try again in a moment.'
        : 'We couldn’t find the media to send to LinkedIn. Attach it to the post again.',
      res.status >= 500 ? 502 : 422,
      res.status >= 500,
    );
  }
  return res;
}

/** Reads a download in the exact part sizes LinkedIn asks for, holding one part at a time. */
class PartReader {
  private readonly reader: ReadableStreamDefaultReader<Uint8Array>;
  private pending: Uint8Array[] = [];
  private pendingBytes = 0;

  constructor(body: ReadableStream<Uint8Array>) {
    this.reader = body.getReader();
  }

  async read(size: number): Promise<Buffer<ArrayBuffer>> {
    while (this.pendingBytes < size) {
      const { done, value } = await this.reader.read();
      if (done) break;
      this.pending.push(value);
      this.pendingBytes += value.length;
    }
    const joined = Buffer.concat(this.pending, this.pendingBytes);
    const part = joined.subarray(0, size);
    this.pending = [joined.subarray(size)];
    this.pendingBytes = Math.max(0, this.pendingBytes - size);
    return part;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
