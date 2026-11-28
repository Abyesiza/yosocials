import { BadRequestException, Injectable } from '@nestjs/common';
import { Platform } from '../../../../common/enums/platform.enum.js';
import {
  PlatformApiError,
  requestJson,
} from '../../../../common/http/http-client.js';
import type {
  PlatformProvider,
  PostMetrics,
  ProviderCapabilities,
  PublishInput,
  PublishResult,
  ReadinessInput,
  VerifiedAccount,
} from '../../interfaces/platform-provider.interface.js';
import { mediaIssues } from '../../media-spec.js';
import { parseCredentialsDto } from '../../parse-credentials.js';
import { downloadMedia, mediaFilename } from '../media-download.js';
import { DiscordCredentialsDto } from './discord-credentials.dto.js';
import type { DiscordMessage, DiscordWebhook } from './discord.types.js';

/** Most bytes in one message, all files together (discord.com/developers/docs/reference#uploading-files). */
const MAX_REQUEST_BYTES = 25 * 1024 * 1024;
const UPLOAD_TIMEOUT_MS = 3 * 60_000;

/**
 * Discord channels via webhooks. Engagement is limited to reaction counts on
 * the message, which the webhook token is allowed to read back.
 */
const ALL = [0, 1, 2, 3, 4, 5, 6];

@Injectable()
export class DiscordProvider implements PlatformProvider<DiscordCredentialsDto> {
  readonly platform = Platform.Discord;
  readonly displayName = 'Discord';
  readonly capabilities: ProviderCapabilities = {
    maxTextLength: 2000,
    lengthUnit: 'characters',
    supportsMetrics: true,
    contentStyle:
      'Community announcement in a server channel. Markdown is supported; keep it friendly and skimmable.',
    // No timing study exists; Discord warns that frequent pings make members mute or leave.
    posting: {
      maxPerDay: 1,
      minSpacingMinutes: 24 * 60,
      windows: [
        { days: ALL, start: '18:00', end: '22:00', weight: 2 },
        { days: [0, 6], start: '12:00', end: '18:00', weight: 1 },
      ],
      avoid: [{ days: ALL, start: '00:00', end: '09:00', weight: 1 }],
      source:
        'Member evenings: no published study of Discord timing; Discord advises few announcements',
      limits: [
        'Per-webhook limits are set at runtime; Discord replies with a wait time when they’re hit',
      ],
    },
    connect: 'credentials',
    // discord.com/developers/docs/reference#uploading-files and resources/webhook#execute-webhook (checked 2026-11-28).
    media: {
      required: false,
      video: true,
      // More than 10 attachments is error 30015 (topics/opcodes-and-status-codes).
      maxImages: 10,
      // Files share one 25 MiB request, so photos are kept to 2.4 MB for 10 to fit.
      imageSpec: {
        types: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        maxBytes: 2_400_000,
        maxLongSide: 4096,
        maxShortSide: 4096,
      },
      // 20 MiB per file since 2026-09-03 (change-log); sides are undocumented, capped so the size goes to quality.
      videoSpec: {
        types: ['video/mp4'],
        codecs: ['avc'],
        maxBytes: 20_000_000,
        maxLongSide: 1920,
        maxShortSide: 1080,
      },
    },
  };

  parseCredentials(raw: unknown): Promise<DiscordCredentialsDto> {
    return parseCredentialsDto(DiscordCredentialsDto, raw);
  }

  async verify(credentials: DiscordCredentialsDto): Promise<VerifiedAccount> {
    const webhook = await requestJson<DiscordWebhook>(credentials.webhookUrl);
    return {
      externalId: webhook.id,
      handle: `#${webhook.channel_id}`,
      displayName: webhook.name ?? 'Discord webhook',
      profileUrl: webhook.guild_id
        ? `https://discord.com/channels/${webhook.guild_id}/${webhook.channel_id}`
        : undefined,
      avatarUrl: webhook.avatar
        ? `https://cdn.discordapp.com/avatars/${webhook.id}/${webhook.avatar}.png`
        : undefined,
    };
  }

  readinessIssues({ text, media }: ReadinessInput): string[] {
    const issues: string[] = [];
    if (!text.trim() && media.length === 0)
      issues.push('write something or attach media.');
    if (media.reduce((sum, m) => sum + m.size, 0) > MAX_REQUEST_BYTES) {
      issues.push(
        'keep the photos and videos to 25 MB in total. Remove some, or use smaller ones.',
      );
    }
    return issues;
  }

  async publish(
    credentials: DiscordCredentialsDto,
    input: PublishInput,
  ): Promise<PublishResult> {
    const issues = [
      ...mediaIssues(input.media, this.capabilities.media),
      ...this.readinessIssues(input),
    ];
    if (issues.length > 0)
      throw new BadRequestException(`To post to Discord, ${issues[0]}`);

    // Discord has no idempotency key; the publishing service's claim-before-
    // send locking is what prevents double posts here.
    const message =
      input.media.length === 0
        ? await requestJson<DiscordMessage>(credentials.webhookUrl, {
            query: { wait: 'true' },
            json: { content: input.text, allowed_mentions: { parse: [] } },
          })
        : await this.sendWithFiles(credentials, input);
    const webhook = await requestJson<DiscordWebhook>(credentials.webhookUrl);
    return {
      externalId: message.id,
      externalUrl: webhook.guild_id
        ? `https://discord.com/channels/${webhook.guild_id}/${message.channel_id}/${message.id}`
        : undefined,
      publishedAt: new Date(message.timestamp),
    };
  }

  /** One message with the files attached as `files[n]`, described in `payload_json`. */
  private async sendWithFiles(
    credentials: DiscordCredentialsDto,
    { text, media }: PublishInput,
  ): Promise<DiscordMessage> {
    const files = await Promise.all(
      media.map((item) => downloadMedia(item, 'Discord')),
    );
    const names = media.map(mediaFilename);
    const form = new FormData();
    form.append(
      'payload_json',
      JSON.stringify({
        ...(text.trim() && { content: text }),
        allowed_mentions: { parse: [] },
        attachments: names.map((filename, id) => ({ id, filename })),
      }),
    );
    files.forEach((file, i) => form.append(`files[${i}]`, file, names[i]));
    try {
      return await requestJson<DiscordMessage>(credentials.webhookUrl, {
        query: { wait: 'true' },
        multipart: form,
        timeoutMs: UPLOAD_TIMEOUT_MS,
      });
    } catch (error) {
      // An upload that timed out may still have landed.
      if (error instanceof PlatformApiError && error.status === 0) {
        throw new PlatformApiError(
          'We lost contact with Discord while sending this. It may have been posted, so check the channel before you try again.',
          0,
          false,
        );
      }
      throw error;
    }
  }

  async fetchMetrics(
    credentials: DiscordCredentialsDto,
    externalIds: string[],
  ): Promise<Map<string, PostMetrics>> {
    const result = new Map<string, PostMetrics>();
    for (const id of externalIds) {
      try {
        const message = await requestJson<DiscordMessage>(
          `${credentials.webhookUrl}/messages/${encodeURIComponent(id)}`,
        );
        const reactions = message.reactions ?? [];
        result.set(id, {
          likes: reactions.reduce((sum, r) => sum + r.count, 0),
          replies: message.thread?.message_count,
          raw: { reactions },
        });
      } catch (error) {
        if (error instanceof PlatformApiError && error.status === 404) continue;
        throw error;
      }
    }
    return result;
  }
}
