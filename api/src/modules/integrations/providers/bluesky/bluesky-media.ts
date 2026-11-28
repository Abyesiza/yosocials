import { type BlobRef, type Client, isBlobRef, jsonToLex } from '@atproto/lex';
import {
  extractPdsEndpoint,
  type PasswordSession,
} from '@atproto/lex-password-session';
import { app, com } from '@bsky/sdk/lexicons';
import {
  PlatformApiError,
  requestJson,
} from '../../../../common/http/http-client.js';
import type { PublishMedia } from '../../interfaces/platform-provider.interface.js';
import { downloadMedia, mediaFilename } from '../media-download.js';

export const VIDEO_SERVICE = 'https://video.bsky.app';
/** Between job status checks. */
export const POLL_MS = 1_500;
/** Download (3 min) + upload + this stays inside publishing's 10-minute stuck window. */
const MAX_PROCESSING_MS = 4 * 60_000;
const UPLOAD_TIMEOUT_MS = 3 * 60_000;
/** Service tokens for the upload last 30 minutes, as Bluesky's own app asks. */
const TOKEN_TTL_SEC = 30 * 60;

type ImagesEmbed = ReturnType<typeof app.bsky.embed.images.$build>;
type VideoEmbed = ReturnType<typeof app.bsky.embed.video.$build>;

/** The parts of app.bsky.video.defs#jobStatus we read, as JSON from the video service. */
interface JobStatus {
  jobId: string;
  state: string;
  blob?: unknown;
  failureCode?: string;
  error?: string;
  message?: string;
}

interface UploadLimits {
  canUpload: boolean;
  remainingDailyVideos?: number;
  remainingDailyBytes?: number;
  message?: string;
  error?: string;
}

/** Uploads photos as blobs to the user's PDS and builds an `app.bsky.embed.images`. */
export async function imagesEmbed(
  client: Client,
  media: PublishMedia[],
): Promise<ImagesEmbed> {
  const images: ImagesEmbed['images'] = [];
  for (const item of media) {
    const data = await downloadMedia(item, 'Bluesky');
    const { body } = await client.uploadBlob(data, {
      // Checked against imageSpec.types, so it is a MIME type.
      encoding: item.contentType as `${string}/${string}`,
    });
    images.push({
      image: body.blob,
      // Alt text isn't collected yet; the lexicon requires the field.
      alt: '',
      ...aspectRatio(item),
    });
  }
  return app.bsky.embed.images.$build({ images });
}

/**
 * Sends a video through Bluesky's video service (bsky.network/docs/about-bluesky-content/video):
 * a service token for the user's PDS, the raw upload, then the job polled
 * until the processed blob is on the PDS.
 */
export async function videoEmbed(
  client: Client,
  session: PasswordSession,
  item: PublishMedia,
): Promise<VideoEmbed> {
  await checkUploadLimits(client, session, item);
  const pds =
    extractPdsEndpoint(session.session.didDoc) ?? session.session.service;
  const token = await serviceToken(
    client,
    `did:web:${new URL(pds).host}`,
    'com.atproto.repo.uploadBlob',
  );
  const data = await downloadMedia(item, 'Bluesky');
  const job = await upload(token, session.did, item, data);
  const blob = await processed(job);
  return app.bsky.embed.video.$build({ video: blob, ...aspectRatio(item) });
}

async function checkUploadLimits(
  client: Client,
  session: PasswordSession,
  item: PublishMedia,
): Promise<void> {
  let limits: UploadLimits;
  try {
    const token = await serviceToken(
      client,
      'did:web:video.bsky.app',
      'app.bsky.video.getUploadLimits',
    );
    limits = await requestJson<UploadLimits>(
      `${VIDEO_SERVICE}/xrpc/app.bsky.video.getUploadLimits`,
      { headers: { authorization: `Bearer ${token}` } },
    );
  } catch {
    // This check only gives a clearer message; the upload reports the same problems.
    return;
  }
  const overDaily =
    limits.remainingDailyVideos === 0 ||
    (limits.remainingDailyBytes !== undefined &&
      limits.remainingDailyBytes < item.size);
  if (limits.canUpload && !overDaily) return;

  const message =
    session.session.emailConfirmed === false
      ? 'Bluesky only takes videos from accounts with a verified email address. Verify your email in Bluesky’s settings, then publish again.'
      : overDaily
        ? 'This Bluesky account has reached its daily video limit. Try again tomorrow.'
        : 'Bluesky isn’t taking videos from this account right now. Try again later, or post photos instead.';
  throw new PlatformApiError(message, 422, false, limits);
}

async function serviceToken(
  client: Client,
  aud: string,
  lxm: 'com.atproto.repo.uploadBlob' | 'app.bsky.video.getUploadLimits',
): Promise<string> {
  // Asked of the user's own PDS, not the AppView the client proxies to.
  const { token } = await client.call(
    com.atproto.server.getServiceAuth,
    { aud, lxm, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SEC },
    { service: null },
  );
  return token;
}

async function upload(
  token: string,
  did: string,
  item: PublishMedia,
  data: Blob,
): Promise<JobStatus> {
  try {
    const { jobStatus } = await requestJson<{ jobStatus: JobStatus }>(
      `${VIDEO_SERVICE}/xrpc/app.bsky.video.uploadVideo`,
      {
        method: 'POST',
        query: { did, name: mediaFilename(item) },
        headers: { authorization: `Bearer ${token}` },
        binary: { data, contentType: 'video/mp4' },
        timeoutMs: UPLOAD_TIMEOUT_MS,
      },
    );
    return jobStatus;
  } catch (error) {
    if (!(error instanceof PlatformApiError) || error.status === 0) throw error;
    // A video sent before (say, by a retried publish) answers with its existing job.
    const body = error.body as
      (Partial<JobStatus> & { jobStatus?: JobStatus }) | undefined;
    if (body?.error === 'already_exists') {
      const existing = body.jobStatus ?? body;
      if (existing.jobId) return existing as JobStatus;
    }
    // Never 401/403: that would mark the account for reconnecting, which won't help here.
    throw new PlatformApiError(
      error.retryable
        ? 'Bluesky couldn’t take the video right now. Try again in a moment.'
        : 'Bluesky didn’t accept this video. Use an MP4 file up to 300 MB, then try again.',
      error.retryable ? 502 : 422,
      error.retryable,
      error.body,
    );
  }
}

/** Waits until the job has stored the processed video on the PDS, and returns its blob. */
async function processed(job: JobStatus): Promise<BlobRef> {
  const deadline = Date.now() + MAX_PROCESSING_MS;
  let status = job;
  for (;;) {
    const blob = status.blob && jsonToLex(status.blob as never);
    if (isBlobRef(blob)) return blob;
    if (status.state === 'JOB_STATE_FAILED') throw jobFailure(status);
    if (Date.now() > deadline) {
      throw new PlatformApiError(
        'Bluesky took too long to process the video. Try again.',
        504,
        true,
        status,
      );
    }
    await sleep(POLL_MS);
    ({ jobStatus: status } = await requestJson<{ jobStatus: JobStatus }>(
      `${VIDEO_SERVICE}/xrpc/app.bsky.video.getJobStatus`,
      { query: { jobId: job.jobId } },
    ));
  }
}

function jobFailure(status: JobStatus): PlatformApiError {
  switch (status.failureCode) {
    case 'validation_failure':
      return new PlatformApiError(
        'Bluesky didn’t accept this video. Use an MP4 file with H.264 video, then try again.',
        422,
        false,
        status,
      );
    case 'encoding_failure':
      return new PlatformApiError(
        'Bluesky couldn’t process this video. Try a different MP4 file.',
        422,
        false,
        status,
      );
    case 'pds_upload_unsupported_blob_size':
      return new PlatformApiError(
        'This video is too large for your Bluesky server. Use a shorter or smaller video.',
        422,
        false,
        status,
      );
    default:
      return new PlatformApiError(
        'Bluesky couldn’t finish processing the video. Try again in a moment.',
        502,
        true,
        status,
      );
  }
}

function aspectRatio(item: PublishMedia) {
  return item.width && item.height
    ? {
        aspectRatio: {
          width: Math.round(item.width),
          height: Math.round(item.height),
        },
      }
    : {};
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
