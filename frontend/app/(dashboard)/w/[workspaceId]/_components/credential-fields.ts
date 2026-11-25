import type { Platform } from "@/app/lib/api/types";

export interface CredentialSpec {
  intro: string;
  steps: string[];
  tips?: string[];
  link?: { href: string; label: string };
  fields: { name: string; label: string; placeholder: string; secret?: boolean }[];
}

export const CREDENTIAL_FIELDS: Record<Platform, CredentialSpec> = {
  bluesky: {
    intro: "Bluesky connects with your handle and an app password. Never use your main password.",
    steps: [
      "Open Bluesky and go to Settings → Privacy and security → App passwords.",
      "Click Add App Password and give it a name, for example “YoSocials”.",
      "Copy the generated password (xxxx-xxxx-xxxx-xxxx). Bluesky only shows it once.",
      "Enter your full handle below, for example you.bsky.social, and paste the app password.",
    ],
    tips: ["You can revoke the app password at any time from the same screen."],
    link: { href: "https://bsky.app/settings/app-passwords", label: "Open Bluesky app passwords" },
    fields: [
      { name: "identifier", label: "Handle", placeholder: "you.bsky.social" },
      { name: "appPassword", label: "App password", placeholder: "xxxx-xxxx-xxxx-xxxx", secret: true },
    ],
  },
  mastodon: {
    intro: "Mastodon accounts live on an instance, so you create the access token on your own instance.",
    steps: [
      "Sign in to your Mastodon instance in a browser.",
      "Go to Preferences → Development and click New application.",
      "Name it, for example “YoSocials”, and tick the scopes read:accounts, read:statuses and write:statuses. Untick the rest.",
      "Click Submit, open the new application and copy “Your access token”.",
      "Enter your instance URL below, for example https://mastodon.social, and paste the token.",
    ],
    tips: ["The instance URL is the address you sign in at, starting with https://."],
    fields: [
      { name: "instanceUrl", label: "Instance URL", placeholder: "https://mastodon.social" },
      { name: "accessToken", label: "Access token", placeholder: "Paste the token", secret: true },
    ],
  },
  telegram: {
    intro: "Telegram posts to a channel through a bot you create. You need the bot token and the bot must be an admin of the channel.",
    steps: [
      "In Telegram, open a chat with @BotFather and send /newbot.",
      "Choose a display name and a username ending in “bot”. BotFather replies with an HTTP API token (123456789:AA…). Copy it.",
      "Open your channel, tap its name, then Edit (pencil) → Administrators → Add Administrator. On desktop use ⋮ → Manage channel → Administrators.",
      "Search for your bot by its exact username, select it and turn on “Post Messages”, then save.",
      "Enter the channel below: @channelname for a public channel, or the numeric id starting with -100 for a private one.",
    ],
    tips: [
      "Lost the token? Send /mybots to @BotFather, pick your bot, then API Token.",
      "To find a private channel's id, forward one of its posts to @userinfobot or @getidsbot.",
      "Only the channel owner, or an admin allowed to add admins, can add the bot.",
    ],
    link: { href: "https://t.me/BotFather", label: "Open @BotFather" },
    fields: [
      { name: "botToken", label: "Bot token", placeholder: "123456789:AA…", secret: true },
      { name: "chatId", label: "Channel", placeholder: "@yourchannel or -100…" },
    ],
  },
  discord: {
    intro: "Discord posts through a channel webhook. No bot or app is needed.",
    steps: [
      "Open your Discord server and go to Server Settings → Integrations → Webhooks.",
      "Click New Webhook and give it a name.",
      "Choose the channel it should post to.",
      "Click Copy Webhook URL and paste it below.",
    ],
    tips: ["You need the Manage Webhooks permission on the server.", "Treat the webhook URL like a password: anyone with it can post to the channel."],
    fields: [{ name: "webhookUrl", label: "Webhook URL", placeholder: "https://discord.com/api/webhooks/…", secret: true }],
  },
};
