import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProviderSession } from './entities/provider-session.entity.js';
import { LinkPreviewService } from './link-preview/link-preview.service.js';
import { BlueskyClientFactory } from './providers/bluesky/bluesky-client.js';
import { ProviderSessionsService } from './sessions/provider-sessions.service.js';
import { IntegrationsController } from './integrations.controller.js';
import { IntegrationsRegistry } from './integrations.registry.js';
import { BlueskyProvider } from './providers/bluesky/bluesky.provider.js';
import { DiscordProvider } from './providers/discord/discord.provider.js';
import { MastodonProvider } from './providers/mastodon/mastodon.provider.js';
import { TelegramProvider } from './providers/telegram/telegram.provider.js';
import { TikTokApi } from './providers/tiktok/tiktok-api.js';
import { TikTokProvider } from './providers/tiktok/tiktok.provider.js';

@Module({
  imports: [TypeOrmModule.forFeature([ProviderSession])],
  controllers: [IntegrationsController],
  providers: [
    ProviderSessionsService,
    LinkPreviewService,
    BlueskyClientFactory,
    BlueskyProvider,
    MastodonProvider,
    TelegramProvider,
    DiscordProvider,
    TikTokApi,
    TikTokProvider,
    IntegrationsRegistry,
  ],
  exports: [IntegrationsRegistry],
})
export class IntegrationsModule {}
