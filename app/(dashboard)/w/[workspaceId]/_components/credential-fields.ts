import type { Platform } from "@/app/lib/api/types";

export interface CredentialSpec {
  help: string;
  fields: { name: string; label: string; placeholder: string; secret?: boolean }[];
}

export const CREDENTIAL_FIELDS: Record<Platform, CredentialSpec> = {
  bluesky: {
    help: "Use an app password, not your main password: Bluesky → Settings → Privacy and security → App passwords.",
    fields: [
      { name: "identifier", label: "Handle", placeholder: "you.bsky.social" },
      { name: "appPassword", label: "App password", placeholder: "xxxx-xxxx-xxxx-xxxx", secret: true },
    ],
  },
  mastodon: {
    help: "On your instance: Preferences → Development → New application with read:accounts, read:statuses and write:statuses. Copy the access token.",
    fields: [
      { name: "instanceUrl", label: "Instance URL", placeholder: "https://mastodon.social" },
      { name: "accessToken", label: "Access token", placeholder: "Paste the token", secret: true },
    ],
  },
  telegram: {
    help: "Create a bot with @BotFather, then add it to your channel as an admin that can post messages.",
    fields: [
      { name: "botToken", label: "Bot token", placeholder: "123456789:AA…", secret: true },
      { name: "chatId", label: "Channel", placeholder: "@yourchannel or -100…" },
    ],
  },
  discord: {
    help: "Server Settings → Integrations → Webhooks → New Webhook → Copy Webhook URL.",
    fields: [{ name: "webhookUrl", label: "Webhook URL", placeholder: "https://discord.com/api/webhooks/…", secret: true }],
  },
};
