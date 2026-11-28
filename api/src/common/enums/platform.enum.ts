/**
 * Platforms the API can publish to. Keys match `app/lib/platforms.ts` in the
 * web app so the UI can look up icons and colors directly.
 *
 * Only platforms with a working provider are listed; add one here when its
 * provider lands in `modules/integrations/providers`.
 */
export enum Platform {
  Bluesky = 'bluesky',
  Mastodon = 'mastodon',
  Telegram = 'telegram',
  Discord = 'discord',
  TikTok = 'tiktok',
  X = 'x',
  LinkedIn = 'linkedin',
}
