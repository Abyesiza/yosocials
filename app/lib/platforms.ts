import type { IconType } from "react-icons";
import {
  SiBluesky,
  SiDevdotto,
  SiDiscord,
  SiDribbble,
  SiFacebook,
  SiFramer,
  SiInstagram,
  SiKick,
  SiMastodon,
  SiNotion,
  SiPinterest,
  SiTelegram,
  SiThreads,
  SiTiktok,
  SiTumblr,
  SiTwitch,
  SiWebflow,
  SiWhatsapp,
  SiWix,
  SiWordpress,
  SiX,
  SiYoutube,
} from "react-icons/si";
// LinkedIn, Slack and Google Business were removed from Simple Icons, so they
// come from Font Awesome instead.
import { FaGoogle, FaLinkedin, FaSlack } from "react-icons/fa6";
import { MdEmail } from "react-icons/md";
import { VscJson } from "react-icons/vsc";

/**
 * What kind of destination a platform is. The agent uses this to decide what
 * a "post" means there: a short social update, a chat/broadcast message, a
 * long-form article/CMS entry, or a live/video upload.
 */
export type PlatformCategory = "social" | "video" | "community" | "publishing" | "other";

export type Platform = {
  label: string;
  Icon: IconType;
  /** Brand color, used for the icon on a white background. */
  color: string;
  category: PlatformCategory;
};

export const platforms = {
  // Social networks
  facebook: { label: "Facebook", Icon: SiFacebook, color: "#0866FF", category: "social" },
  instagram: { label: "Instagram", Icon: SiInstagram, color: "#FF0069", category: "social" },
  x: { label: "X", Icon: SiX, color: "#000000", category: "social" },
  linkedin: { label: "LinkedIn", Icon: FaLinkedin, color: "#0A66C2", category: "social" },
  pinterest: { label: "Pinterest", Icon: SiPinterest, color: "#BD081C", category: "social" },
  bluesky: { label: "Bluesky", Icon: SiBluesky, color: "#1185FE", category: "social" },
  threads: { label: "Threads", Icon: SiThreads, color: "#000000", category: "social" },
  mastodon: { label: "Mastodon", Icon: SiMastodon, color: "#6364FF", category: "social" },
  tumblr: { label: "Tumblr", Icon: SiTumblr, color: "#36465D", category: "social" },
  dribbble: { label: "Dribbble", Icon: SiDribbble, color: "#EA4C89", category: "social" },
  googleBusiness: { label: "Google Business", Icon: FaGoogle, color: "#4285F4", category: "social" },

  // Video & streaming
  youtube: { label: "YouTube", Icon: SiYoutube, color: "#FF0000", category: "video" },
  tiktok: { label: "TikTok", Icon: SiTiktok, color: "#000000", category: "video" },
  twitch: { label: "Twitch", Icon: SiTwitch, color: "#9146FF", category: "video" },
  kick: { label: "Kick", Icon: SiKick, color: "#53FC18", category: "video" },

  // Messaging & communities
  whatsapp: { label: "WhatsApp", Icon: SiWhatsapp, color: "#25D366", category: "community" },
  telegram: { label: "Telegram", Icon: SiTelegram, color: "#26A5E4", category: "community" },
  slack: { label: "Slack", Icon: FaSlack, color: "#4A154B", category: "community" },
  discord: { label: "Discord", Icon: SiDiscord, color: "#5865F2", category: "community" },

  // Blogs, CMS & sites
  wordpress: { label: "WordPress", Icon: SiWordpress, color: "#21759B", category: "publishing" },
  devto: { label: "DEV", Icon: SiDevdotto, color: "#0A0A0A", category: "publishing" },
  notion: { label: "Notion", Icon: SiNotion, color: "#000000", category: "publishing" },
  webflow: { label: "Webflow", Icon: SiWebflow, color: "#146EF5", category: "publishing" },
  framer: { label: "Framer", Icon: SiFramer, color: "#0055FF", category: "publishing" },
  wix: { label: "Wix", Icon: SiWix, color: "#000000", category: "publishing" },

  // Everything else
  email: { label: "Email newsletter", Icon: MdEmail, color: "#18181B", category: "other" },
  webhook: { label: "Webhook / API", Icon: VscJson, color: "#18181B", category: "other" },
} satisfies Record<string, Platform>;

export type PlatformKey = keyof typeof platforms;
