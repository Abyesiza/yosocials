import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CryptoService } from '../../../common/crypto/crypto.service.js';
import type { Platform } from '../../../common/enums/platform.enum.js';
import { ProviderSession } from '../entities/provider-session.entity.js';
import type { ProviderSessionStore } from '../interfaces/provider-session-store.interface.js';

@Injectable()
export class ProviderSessionsService implements ProviderSessionStore {
  private readonly logger = new Logger(ProviderSessionsService.name);

  constructor(
    @InjectRepository(ProviderSession)
    private readonly sessions: Repository<ProviderSession>,
    private readonly crypto: CryptoService,
  ) {}

  async load<T>(key: string): Promise<T | null> {
    const row = await this.sessions.findOneBy({ key });
    if (!row) return null;
    try {
      return this.crypto.decryptJson<T>(row.encryptedData);
    } catch {
      // Encrypted with a rotated key: drop it and let the provider log in again.
      this.logger.warn(`Discarding unreadable session ${row.platform}`);
      await this.remove(key);
      return null;
    }
  }

  async save(key: string, platform: Platform, data: unknown): Promise<void> {
    await this.sessions.upsert(
      { key, platform, encryptedData: this.crypto.encryptJson(data) },
      ['key'],
    );
  }

  async remove(key: string): Promise<void> {
    await this.sessions.delete({ key });
  }
}
