import { PlatformApiError } from '../../../common/http/http-client.js';
import type { PublishMedia } from '../interfaces/platform-provider.interface.js';

const DOWNLOAD_TIMEOUT_MS = 3 * 60_000;

/**
 * Reads a post's file from our media URL into memory, for platforms that take
 * the bytes in one request (Telegram, Discord, Bluesky, Mastodon).
 */
export async function downloadMedia(
  item: PublishMedia,
  platform: string,
): Promise<Blob> {
  const retryLater = `We couldn’t read the media to send to ${platform}. Try again in a moment.`;
  let res: Response;
  try {
    res = await fetch(item.url, {
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new PlatformApiError(retryLater, 0, true, { reason });
  }
  if (!res.ok) {
    throw new PlatformApiError(
      res.status >= 500
        ? retryLater
        : `We couldn’t find the media to send to ${platform}. Attach it to the post again.`,
      res.status >= 500 ? 502 : 422,
      res.status >= 500,
      { status: res.status },
    );
  }
  return new Blob([await res.arrayBuffer()], { type: item.contentType });
}

/** The file's name in our storage (`<workspaceId>_<uuid>.<ext>`), shown by some platforms. */
export function mediaFilename(item: PublishMedia): string {
  return new URL(item.url).pathname.split('/').pop() || 'media';
}
