import { SITE } from "@/app/lib/site";

/** Facts the legal pages state about the business. */
export const LEGAL = {
  product: SITE.name,
  legalEntity: `${SITE.owner.name} (${SITE.owner.form})`,
  contactEmail: SITE.email.support,
  privacyEmail: SITE.email.privacy,
  minimumAge: 13,
  effectiveDate: "27 November 2026",
} as const;

/** Official policies of the platforms users can connect (see app/lib/platforms.ts). */
export const PLATFORM_POLICIES = [
  { name: "Bluesky", terms: "https://bsky.social/about/support/tos", privacy: "https://bsky.social/about/support/privacy-policy", live: true },
  { name: "Mastodon", terms: "https://joinmastodon.org/", privacy: "https://joinmastodon.org/", live: true, note: "Each Mastodon server has its own terms and privacy policy, linked from its About page." },
  { name: "Telegram", terms: "https://telegram.org/tos", privacy: "https://telegram.org/privacy", live: true },
  { name: "Discord", terms: "https://discord.com/terms", privacy: "https://discord.com/privacy", live: true },
  { name: "YouTube", terms: "https://www.youtube.com/t/terms", privacy: "https://policies.google.com/privacy", live: false },
  { name: "Meta (Facebook, Instagram, Threads, WhatsApp)", terms: "https://www.facebook.com/terms", privacy: "https://www.facebook.com/privacy/policy", live: false },
  { name: "X", terms: "https://x.com/tos", privacy: "https://x.com/privacy", live: false },
  { name: "LinkedIn", terms: "https://www.linkedin.com/legal/user-agreement", privacy: "https://www.linkedin.com/legal/privacy-policy", live: false },
  { name: "TikTok", terms: "https://www.tiktok.com/legal/terms-of-service", privacy: "https://www.tiktok.com/legal/privacy-policy", live: false },
  { name: "Pinterest", terms: "https://policy.pinterest.com/terms-of-service", privacy: "https://policy.pinterest.com/privacy-policy", live: false },
] as const;
