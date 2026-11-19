import { BadRequestException, Injectable } from '@nestjs/common';
import { Platform } from '../../common/enums/platform.enum.js';
import type { PlatformProvider } from './interfaces/platform-provider.interface.js';
import { BlueskyProvider } from './providers/bluesky/bluesky.provider.js';
import { DiscordProvider } from './providers/discord/discord.provider.js';
import { MastodonProvider } from './providers/mastodon/mastodon.provider.js';
import { TelegramProvider } from './providers/telegram/telegram.provider.js';

/** Looks up the provider for a platform. The single place providers are listed. */
@Injectable()
export class IntegrationsRegistry {
  private readonly providers: ReadonlyMap<Platform, PlatformProvider>;

  constructor(
    bluesky: BlueskyProvider,
    mastodon: MastodonProvider,
    telegram: TelegramProvider,
    discord: DiscordProvider,
  ) {
    const list: PlatformProvider[] = [bluesky, mastodon, telegram, discord];
    this.providers = new Map(list.map((p) => [p.platform, p]));

    const missing = Object.values(Platform).filter(
      (p) => !this.providers.has(p),
    );
    if (missing.length > 0) {
      throw new Error(`No provider registered for: ${missing.join(', ')}`);
    }
  }

  get(platform: Platform): PlatformProvider {
    const provider = this.providers.get(platform);
    if (!provider) {
      throw new BadRequestException(`Unsupported platform: ${platform}`);
    }
    return provider;
  }

  list(): PlatformProvider[] {
    return [...this.providers.values()];
  }
}
