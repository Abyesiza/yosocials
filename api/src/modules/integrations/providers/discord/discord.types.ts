/** Discord webhook API response shapes this provider uses. */

export interface DiscordWebhook {
  id: string;
  name: string | null;
  channel_id: string;
  guild_id?: string;
  avatar: string | null;
}

export interface DiscordReaction {
  count: number;
  emoji: { id: string | null; name: string | null };
}

export interface DiscordMessage {
  id: string;
  channel_id: string;
  timestamp: string;
  reactions?: DiscordReaction[];
  /** Set when the message started a thread. */
  thread?: { message_count?: number };
}
