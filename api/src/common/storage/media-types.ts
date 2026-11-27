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

/** `<workspaceId>/<uuid>.<ext>`: every object lives under its workspace's folder. */
export const MEDIA_PATH_PATTERN =
  /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(mp4|mov|webm|jpg|webp)$/;
