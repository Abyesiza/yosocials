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

  /**
   * Runs `fn` holding a Postgres advisory lock on `key`, so two processes
   * never refresh the same session at once (rotated refresh tokens are
   * single use). `fn` gets a store on the locked transaction, so it needs no
   * second connection; the lock is released when `fn` settles.
   */
  withLock<T>(
    key: string,
    fn: (store: ProviderSessionStore) => Promise<T>,
  ): Promise<T> {
    return this.sessions.manager.transaction(async (tx) => {
      await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [key]);
      return fn(
        new ProviderSessionsService(
          tx.getRepository(ProviderSession),
          this.crypto,
        ),
      );
    });
  }
}
