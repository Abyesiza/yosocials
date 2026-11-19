import { Module } from '@nestjs/common';
import { IntegrationsController } from './integrations.controller.js';
import { IntegrationsRegistry } from './integrations.registry.js';
import { BlueskyProvider } from './providers/bluesky/bluesky.provider.js';
import { DiscordProvider } from './providers/discord/discord.provider.js';
import { MastodonProvider } from './providers/mastodon/mastodon.provider.js';
import { TelegramProvider } from './providers/telegram/telegram.provider.js';

@Module({
  controllers: [IntegrationsController],
  providers: [
    BlueskyProvider,
    MastodonProvider,
    TelegramProvider,
    DiscordProvider,
    IntegrationsRegistry,
  ],
  exports: [IntegrationsRegistry],
})
export class IntegrationsModule {}
