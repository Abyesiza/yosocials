/** Bot API response shapes this provider uses. */

export interface TelegramResponse<T> {
  ok: boolean;
  result: T;
  description?: string;
}

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  username?: string;
  first_name: string;
}

export interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
}

export interface TelegramChatMember {
  status:
    'creator' | 'administrator' | 'member' | 'restricted' | 'left' | 'kicked';
  can_post_messages?: boolean;
}

export interface TelegramMessage {
  message_id: number;
  date: number;
  chat: TelegramChat;
}
