import { BadRequestException, Injectable } from '@nestjs/common';
import { Platform } from '../../../../common/enums/platform.enum.js';
import {
  PlatformApiError,
  requestJson,
} from '../../../../common/http/http-client.js';
import { textLength } from '../../../../common/text/text-length.js';
import type {
  PlatformProvider,
  ProviderCapabilities,
  PublishInput,
  PublishMedia,
  PublishResult,
  ReadinessInput,
  VerifiedAccount,
} from '../../interfaces/platform-provider.interface.js';
import { mediaIssues } from '../../media-spec.js';
import { parseCredentialsDto } from '../../parse-credentials.js';
import { downloadMedia, mediaFilename } from '../media-download.js';
import { TelegramCredentialsDto } from './telegram-credentials.dto.js';
import type {
  TelegramChat,
  TelegramChatMember,
  TelegramMessage,
  TelegramResponse,
  TelegramUser,
} from './telegram.types.js';

/** A caption is shorter than a text message (core.telegram.org/bots/api#sendphoto). */
const MAX_CAPTION = 1024;
/** Up to 50 MB of video going up in one request. */
const UPLOAD_TIMEOUT_MS = 5 * 60_000;

/**
 * Telegram channels via the Bot API. The Bot API can't read a channel post's
 * view count (that needs the MTProto user API), so this provider is
 * publish-only.
 */
const ALL = [0, 1, 2, 3, 4, 5, 6];

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
    // No timing study exists; every post notifies subscribers, so keep to daytime and evening.
    posting: {
      maxPerDay: 3,
      minSpacingMinutes: 120,
      windows: [
        { days: ALL, start: '08:00', end: '10:00', weight: 2 },
        { days: ALL, start: '18:00', end: '21:00', weight: 2 },
        { days: ALL, start: '10:00', end: '18:00', weight: 1 },
      ],
      avoid: [
        { days: ALL, start: '22:00', end: '24:00', weight: 1 },
        { days: ALL, start: '00:00', end: '07:00', weight: 1 },
      ],
      source:
        'Daytime and evening: no published study of Telegram channel timing (each post notifies subscribers)',
      limits: [
        'About 20 messages a minute per group or channel, 1 a second per chat (Telegram Bot API)',
      ],
    },
    connect: 'credentials',
    // Uploaded as multipart: core.telegram.org/bots/api#sending-files (Bot API 10.5, checked 2026-11-28).
    media: {
      required: false,
      video: true,
      maxImages: 10,
      // core.telegram.org/bots/api#sendphoto: 10 MB, width + height ≤ 10000, ratio ≤ 20. Telegram recompresses photos.
      imageSpec: {
        types: ['image/jpeg', 'image/png', 'image/webp'],
        maxBytes: 10_000_000,
        maxLongSide: 10000,
        maxShortSide: 10000,
        maxSideSum: 10000,
        aspect: { min: 1 / 20, max: 20 },
      },
      // core.telegram.org/bots/api#sendvideo: MPEG4 up to 50 MB; sides are undocumented, so 4096 is a sanity cap.
      videoSpec: {
        types: ['video/mp4'],
        codecs: ['avc'],
        maxBytes: 50_000_000,
        maxLongSide: 4096,
        maxShortSide: 4096,
      },
    },
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
        `Make @${bot.username} an admin of the channel with permission to post messages, then connect again.`,
      );
    }

    return {
      externalId: String(chat.id),
      handle: chat.username ? `@${chat.username}` : String(chat.id),
      displayName: chat.title ?? chat.username ?? String(chat.id),
      profileUrl: chat.username ? `https://t.me/${chat.username}` : undefined,
    };
  }

  readinessIssues({ text, media }: ReadinessInput): string[] {
    const issues: string[] = [];
    if (!text.trim() && media.length === 0)
      issues.push('write something or attach media.');
    if (
      media.length > 0 &&
      textLength(text, this.capabilities.lengthUnit) > MAX_CAPTION
    ) {
      issues.push(
        'keep the text to 1,024 characters when posting photos or videos to Telegram, or remove the media.',
      );
    }
    return issues;
  }

  async publish(
    credentials: TelegramCredentialsDto,
    input: PublishInput,
  ): Promise<PublishResult> {
    const issues = [
      ...mediaIssues(input.media, this.capabilities.media),
      ...this.readinessIssues(input),
    ];
    if (issues.length > 0)
      throw new BadRequestException(`To post to Telegram, ${issues[0]}`);

    const message =
      input.media.length === 0
        ? await this.call<TelegramMessage>(credentials, 'sendMessage', {
            chat_id: credentials.chatId,
            text: input.text,
          })
        : await this.sendMedia(credentials, input);
    return {
      externalId: `${message.chat.id}:${message.message_id}`,
      externalUrl: message.chat.username
        ? `https://t.me/${message.chat.username}/${message.message_id}`
        : undefined,
      publishedAt: new Date(message.date * 1000),
    };
  }

  /** Sends the files' bytes, not their URLs: by URL Telegram takes only 5 MB photos and 20 MB files. */
  private async sendMedia(
    credentials: TelegramCredentialsDto,
    { text, media }: PublishInput,
  ): Promise<TelegramMessage> {
    const files = await Promise.all(
      media.map((item) => downloadMedia(item, 'Telegram')),
    );
    const form = new FormData();
    form.append('chat_id', credentials.chatId);
    const caption = text.trim() ? text : undefined;
    try {
      if (media.length > 1) {
        // The caption on the first item is shown for the whole album.
        const items = media.map((_, i) => ({
          type: 'photo',
          media: `attach://photo${i}`,
          ...(i === 0 && caption && { caption }),
        }));
        form.append('media', JSON.stringify(items));
        files.forEach((file, i) =>
          form.append(`photo${i}`, file, mediaFilename(media[i])),
        );
        const messages = await this.call<TelegramMessage[]>(
          credentials,
          'sendMediaGroup',
          form,
        );
        return messages[0];
      }
      if (caption) form.append('caption', caption);
      const [item] = media;
      if (item.kind === 'image') {
        form.append('photo', files[0], mediaFilename(item));
        return await this.call<TelegramMessage>(credentials, 'sendPhoto', form);
      }
      appendVideoDetails(form, item);
      form.append('video', files[0], mediaFilename(item));
      return await this.call<TelegramMessage>(credentials, 'sendVideo', form);
    } catch (error) {
      // Telegram has no idempotency keys: an upload that timed out may have landed.
      if (error instanceof PlatformApiError && error.status === 0) {
        throw new PlatformApiError(
          'We lost contact with Telegram while sending this. It may have been posted, so check the channel before you try again.',
          0,
          false,
        );
      }
      throw error;
    }
  }

  private async call<T>(
    credentials: TelegramCredentialsDto,
    method: string,
    params: Record<string, unknown> | FormData = {},
  ): Promise<T> {
    const response = await requestJson<TelegramResponse<T>>(
      `https://api.telegram.org/bot${credentials.botToken}/${method}`,
      params instanceof FormData
        ? { multipart: params, timeoutMs: UPLOAD_TIMEOUT_MS }
        : { json: params },
    );
    return response.result;
  }
}

/** So Telegram shows the video in its shape and can play it while it loads. */
function appendVideoDetails(form: FormData, item: PublishMedia): void {
  if (item.width && item.height) {
    form.append('width', String(item.width));
    form.append('height', String(item.height));
  }
  if (item.durationSec) {
    form.append('duration', String(Math.round(item.durationSec)));
  }
  form.append('supports_streaming', 'true');
}
