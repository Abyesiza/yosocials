import type { PlatformKey } from "@/app/lib/platforms";

// Platforms with a working connector in the API today.
export const LIVE_PLATFORMS: PlatformKey[] = ["bluesky", "mastodon", "telegram", "discord"];

export const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#solutions", label: "Solutions" },
  { href: "#platforms", label: "Platforms" },
];

export const SCREENS = {
  feed: { src: "/marketing/feed-desktop.png", alt: "Yo Socials home feed showing posts from Bluesky and Mastodon with likes, reposts and replies" },
  phone: { src: "/marketing/feed-phone.png", alt: "Yo Socials feed on a phone" },
  accounts: { src: "/marketing/accounts-desktop.png", alt: "Connecting Bluesky, Mastodon, Telegram and Discord accounts" },
  create: { src: "/marketing/create-desktop.png", alt: "Writing one post with a separate preview and character limit for each platform" },
  calendar: { src: "/marketing/calendar-desktop.png", alt: "Weekly content calendar with drafts, scheduled and published posts" },
  analytics: { src: "/marketing/analytics-desktop.png", alt: "Analytics with engagement by account and top posts" },
} as const;
