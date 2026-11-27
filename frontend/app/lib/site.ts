/** Brand, domain and owner facts shared by metadata, legal pages and structured data. */
export const SITE = {
  name: "Aby Socials",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "https://abysocials.com").replace(/\/$/, ""),
  domain: "abysocials.com",
  tagline: "Plan, post and grow on every platform",
  description:
    "Aby Socials is the AI social media agent that drafts a content calendar for each account, publishes on time and shows how every post performs. Bluesky, Mastodon, Telegram, Discord and more, in one place.",
  keywords: [
    "Aby Socials",
    "AI social media agent",
    "social media scheduler",
    "social media management tool",
    "content calendar",
    "AI post generator",
    "schedule posts",
    "Bluesky scheduler",
    "Mastodon scheduler",
    "Telegram channel posting",
    "Discord announcements",
    "social media analytics",
  ],
  logo: "/logo.png",
  ogImage: { url: "/marketing/feed-desktop.png", width: 2880, height: 1800, alt: "Aby Socials unified feed across Bluesky, Mastodon, Telegram and Discord" },
  owner: {
    name: "METIS ANALYTICA CO. LTD",
    form: "Private Limited By Shares",
  },
  email: { support: "joel@metisanalytica.org", privacy: "joel@metisanalytica.org" },
} as const;

export const absoluteUrl = (path = "/") => `${SITE.url}${path === "/" ? "" : path}`;
