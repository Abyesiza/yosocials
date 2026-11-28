import { Platform } from '../../common/enums/platform.enum.js';

/** Per-platform advice for prompts that use trends, covering what each platform does and doesn't let us know. */
export const TREND_GUIDANCE: Partial<Record<Platform, string>> = {
  [Platform.TikTok]:
    'There is no legitimate way for apps to see trending TikTok sounds, and business accounts may only use sounds from TikTok’s Commercial Music Library. Suggest formats, hooks and hashtags, and tell the person to pick a sound from the Commercial Music Library in the TikTok app (TikTok Creative Center shows what’s trending).',
  [Platform.X]:
    'X’s own trending topics aren’t included, so lean on the other signals. Keep hashtags to 1 or 2, and only where people already use them.',
  [Platform.Mastodon]:
    'Mastodon has no algorithmic feed, so people find posts through hashtags: add 2 to 4 relevant ones in CamelCase (#SmallBusiness) so screen readers read them well. Its trending tags come from mastodon.social and aren’t specific to any country.',
  [Platform.Bluesky]:
    'Bluesky’s trending topics are platform-wide and mostly news, so use one only when it clearly fits the brief. Hashtags matter less on Bluesky; 1 or 2 at most.',
  [Platform.LinkedIn]:
    'Tie a trend in only when it matters to the audience’s work or industry, with a useful point of view rather than a hot take. Use 3 hashtags at most.',
};
