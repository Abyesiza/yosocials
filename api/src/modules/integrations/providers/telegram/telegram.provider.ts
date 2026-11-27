import { BadRequestException, Injectable } from '@nestjs/common';
import { Platform } from '../../../../common/enums/platform.enum.js';
import { requestJson } from '../../../../common/http/http-client.js';
import type {
  PlatformProvider,
  ProviderCapabilities,
  PublishInput,
  PublishResult,
  VerifiedAccount,
} from '../../interfaces/platform-provider.interface.js';
import { parseCredentialsDto } from '../../parse-credentials.js';
import { TelegramCredentialsDto } from './telegram-credentials.dto.js';
import type {
  TelegramChat,
  TelegramChatMember,
  TelegramMessage,
  TelegramResponse,
  TelegramUser,
} from './telegram.types.js';

/**
 * Telegram channels via the Bot API. The Bot API can't read a channel post's
 * view count (that needs the MTProto user API), so this provider is
 * publish-only.
 */
@Injectable()
export class TelegramProvider implements PlatformProvider<TelegramCredentialsDto> {
  readonly platform = Platform.Telegram;
  readonly displayName = 'Telegram';
  readonly capabilities: ProviderCapabilities = {
    maxTextLength: 4096,
    lengthUnit: 'characters',
    supportsMetrics: false,
    contentStyle:
      'Channel broadcast message. Can be longer and more detailed; emojis and short paragraphs work well.',
    connect: 'credentials',
  };

  parseCredentials(raw: unknown): Promise<TelegramCredentialsDto> {
    return parseCredentialsDto(TelegramCredentialsDto, raw);
  }

  async verify(credentials: TelegramCredentialsDto): Promise<VerifiedAccount> {
    const bot = await this.call<TelegramUser>(credentials, 'getMe');
    const chat = await this.call<TelegramChat>(credentials, 'getChat', {
      chat_id: credentials.chatId,
    });
    const member = await this.call<TelegramChatMember>(
      credentials,
      'getChatMember',
      { chat_id: credentials.chatId, user_id: bot.id },
    );

    const canPost =
      member.status === 'creator' ||
      (member.status === 'administrator' && member.can_post_messages !== false);
    if (!canPost) {
      throw new BadRequestException(
        `@${bot.username} must be an admin of this chat with permission to post messages`,
      );
    }

    return {
      externalId: String(chat.id),
      handle: chat.username ? `@${chat.username}` : String(chat.id),
      displayName: chat.title ?? chat.username ?? String(chat.id),
      profileUrl: chat.username ? `https://t.me/${chat.username}` : undefined,
    };
  }

  async publish(
    credentials: TelegramCredentialsDto,
    input: PublishInput,
  ): Promise<PublishResult> {
    const message = await this.call<TelegramMessage>(
      credentials,
      'sendMessage',
      { chat_id: credentials.chatId, text: input.text },
    );
    return {
      externalId: `${message.chat.id}:${message.message_id}`,
      externalUrl: message.chat.username
        ? `https://t.me/${message.chat.username}/${message.message_id}`
        : undefined,
      publishedAt: new Date(message.date * 1000),
    };
  }

  private async call<T>(
    credentials: TelegramCredentialsDto,
    method: string,
    params?: Record<string, unknown>,
  ): Promise<T> {
    const response = await requestJson<TelegramResponse<T>>(
      `https://api.telegram.org/bot${credentials.botToken}/${method}`,
      { json: params ?? {} },
    );
    return response.result;
  }
}
