import {
  PlatformApiError,
  requestJson,
} from '../../../../common/http/http-client.js';
import type { PublishMedia } from '../../interfaces/platform-provider.interface.js';
import { downloadMedia, mediaFilename } from '../media-download.js';
import type {
  MastodonInstance,
  MastodonMediaAttachment,
} from './mastodon.types.js';

/** Between processing checks. */
export const POLL_MS = 1_000;
/** Stay well inside publishing's 10-minute stuck window. */
const MAX_PROCESSING_MS = 4 * 60_000;
const UPLOAD_TIMEOUT_MS = 3 * 60_000;
const MB = 1024 * 1024;

/**
 * Uploads a post's files (docs.joinmastodon.org/methods/media/): POST
 * /api/v2/media answers 202 with no URL while the server still processes
 * (typical for video), so each is polled until ready. Returns the media ids.
 */
export async function uploadMedia(
  base: string,
  auth: Record<string, string>,
  media: PublishMedia[],
): Promise<string[]> {
  const ids: string[] = [];
  for (const item of media) {
    const form = new FormData();
    form.append(
      'file',
      await downloadMedia(item, 'Mastodon'),
      mediaFilename(item),
    );
    const attachment = await requestJson<MastodonMediaAttachment>(
      `${base}/api/v2/media`,
      { headers: auth, multipart: form, timeoutMs: UPLOAD_TIMEOUT_MS },
    ).catch((error: unknown) => {
      throw uploadError(error, item);
    });
    if (attachment.url === null) await processed(base, auth, attachment.id);
    ids.push(attachment.id);
  }
  return ids;
}

/**
 * Checks the files against the server's own limits, which can be lower than
 * Mastodon's defaults. Phrased to follow “To post to Mastodon, …”; null when
 * they fit or the server doesn't say.
 */
export async function instanceIssue(
  base: string,
  media: PublishMedia[],
): Promise<string | null> {
  const config = await requestJson<MastodonInstance>(`${base}/api/v2/instance`)
    .then((instance) => instance.configuration)
    .catch(() => undefined);
  const max = config?.statuses?.max_media_attachments;
  if (max && media.length > max) {
    return `add up to ${max} photos. Your Mastodon server allows ${max} in a post.`;
  }
  const limits = config?.media_attachments ?? {};
  for (const item of media) {
    const noun = item.kind === 'image' ? 'photo' : 'video';
    const bytes =
      item.kind === 'image' ? limits.image_size_limit : limits.video_size_limit;
    const pixels =
      item.kind === 'image'
        ? limits.image_matrix_limit
        : limits.video_matrix_limit;
    if (bytes && item.size > bytes) {
      return `use a ${noun} up to ${Math.floor(bytes / MB)} MB. That’s the most your Mastodon server takes.`;
    }
    if (
      pixels &&
      item.width &&
      item.height &&
      item.width * item.height > pixels
    ) {
      return `use a smaller ${noun}. This one has more pixels than your Mastodon server takes.`;
    }
  }
  return null;
}

/** GET /api/v1/media/:id answers 206 (no URL yet) while processing, 200 when ready, 422 on failure. */
async function processed(
  base: string,
  auth: Record<string, string>,
  id: string,
): Promise<void> {
  const deadline = Date.now() + MAX_PROCESSING_MS;
  for (;;) {
    if (Date.now() > deadline) {
      throw new PlatformApiError(
        'Mastodon took too long to process the media. Try again.',
        504,
        true,
      );
    }
    await sleep(POLL_MS);
    let attachment: MastodonMediaAttachment;
    try {
      attachment = await requestJson<MastodonMediaAttachment>(
        `${base}/api/v1/media/${encodeURIComponent(id)}`,
        { headers: auth },
      );
    } catch (error) {
      if (error instanceof PlatformApiError && error.status === 422) {
        throw new PlatformApiError(
          'Your Mastodon server couldn’t process this media. Try a different file.',
          422,
          false,
          error.body,
        );
      }
      throw error;
    }
    if (attachment.url !== null) return;
  }
}

function uploadError(error: unknown, item: PublishMedia): unknown {
  if (!(error instanceof PlatformApiError)) return error;
  if (error.status === 403) {
    return new PlatformApiError(
      'This Mastodon access token can’t upload photos or videos. Create a new token with write:media ticked as well, then reconnect the account with it.',
      403,
      false,
      error.body,
    );
  }
  if (error.status === 413 || error.status === 422) {
    const noun = item.kind === 'image' ? 'photo' : 'video';
    return new PlatformApiError(
      `Your Mastodon server didn’t accept this ${noun}. Use a smaller file or a different format, then try again.`,
      422,
      false,
      error.body,
    );
  }
  return error;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
