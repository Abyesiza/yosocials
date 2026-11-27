import { Injectable } from '@nestjs/common';
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
  VerifiedAccount,
} from '../../interfaces/platform-provider.interface.js';
import { parseCredentialsDto } from '../../parse-credentials.js';
import { DiscordCredentialsDto } from './discord-credentials.dto.js';
import type { DiscordMessage, DiscordWebhook } from './discord.types.js';

/**
 * Discord channels via webhooks. Engagement is limited to reaction counts on
 * the message, which the webhook token is allowed to read back.
 */
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
    connect: 'credentials',
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

  async publish(
    credentials: DiscordCredentialsDto,
    input: PublishInput,
  ): Promise<PublishResult> {
    // Discord has no idempotency key; the publishing service's claim-before-
    // send locking is what prevents double posts here.
    const message = await requestJson<DiscordMessage>(credentials.webhookUrl, {
      query: { wait: 'true' },
      json: { content: input.text, allowed_mentions: { parse: [] } },
    });
    const webhook = await requestJson<DiscordWebhook>(credentials.webhookUrl);
    return {
      externalId: message.id,
      externalUrl: webhook.guild_id
        ? `https://discord.com/channels/${webhook.guild_id}/${message.channel_id}/${message.id}`
        : undefined,
      publishedAt: new Date(message.timestamp),
    };
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
