import type { MediaKind } from '../../modules/integrations/interfaces/platform-provider.interface.js';

/** Formats accepted for upload, with the file extension each is stored under. */
export const MEDIA_TYPES: Readonly<
  Record<string, { kind: MediaKind; ext: string }>
> = {
  'video/mp4': { kind: 'video', ext: 'mp4' },
  'video/quicktime': { kind: 'video', ext: 'mov' },
  'video/webm': { kind: 'video', ext: 'webm' },
  'image/jpeg': { kind: 'image', ext: 'jpg' },
  'image/webp': { kind: 'image', ext: 'webp' },
};

export const MEDIA_CONTENT_TYPES = Object.keys(MEDIA_TYPES);

/** Matches the web app's UploadThing route limits (`app/api/uploadthing/core.ts`). */
export const MAX_BYTES: Readonly<Record<MediaKind, number>> = {
  video: 512 * 1024 * 1024,
  image: 16 * 1024 * 1024,
};
export const MAX_IMAGES = 35;

/** `<workspaceId>_<uuid>.<ext>`: the UploadThing custom id, which ties a file to its workspace. */
export const MEDIA_PATH_PATTERN =
  /^[0-9a-f-]{36}_[0-9a-f-]{36}\.(mp4|mov|webm|jpg|webp)$/;
