import type { Platform } from "@/app/lib/api/types";

export interface CredentialSpec {
  intro: string;
  steps: string[];
  tips?: string[];
  link?: { href: string; label: string };
  fields: { name: string; label: string; placeholder: string; secret?: boolean }[];
}

/** Platforms that connect by pasting credentials; OAuth platforms (TikTok, X) sign in instead. */
export const CREDENTIAL_FIELDS: Partial<Record<Platform, CredentialSpec>> = {
  bluesky: {
    intro: "Bluesky connects with your handle and an app password. Never use your main password.",
    steps: [
      "Open Bluesky and go to Settings → Privacy and security → App passwords.",
      "Click Add App Password and give it a name, for example “Aby Socials”.",
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
    intro: "Your Mastodon account lives on an instance, such as mastodon.social. You create an access token there so we can post for you.",
    steps: [
      "Sign in to your Mastodon instance in a browser.",
      "Go to Preferences → Development and click New application.",
      "Name it, for example “Aby Socials”. Under Scopes, tick only read:accounts, read:statuses and write:statuses.",
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
    intro: "We post to your Telegram channel through a bot you create. You need the bot’s token, and the bot must be an admin of the channel.",
    steps: [
      "In Telegram, open a chat with @BotFather and send /newbot.",
      "Choose a display name and a username ending in “bot”. BotFather replies with an HTTP API token (123456789:AA…). Copy it.",
      "Open your channel, tap its name, then Edit (pencil) → Administrators → Add Administrator. On desktop use ⋮ → Manage channel → Administrators.",
      "Search for your bot by its exact username, select it and turn on “Post Messages”, then save.",
      "Enter the channel below: @channelname for a public channel, or the numeric ID starting with -100 for a private one.",
    ],
    tips: [
      "Lost the token? Send /mybots to @BotFather, pick your bot, then API Token.",
      "To find a private channel’s ID, forward one of its posts to @userinfobot or @getidsbot.",
      "Only the channel owner, or an admin allowed to add admins, can add the bot.",
    ],
    link: { href: "https://t.me/BotFather", label: "Open @BotFather" },
    fields: [
      { name: "botToken", label: "Bot token", placeholder: "123456789:AA…", secret: true },
      { name: "chatId", label: "Channel", placeholder: "@yourchannel or -100…" },
    ],
  },
  discord: {
    intro: "We post to Discord through a channel webhook. You don’t need a bot or app.",
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
