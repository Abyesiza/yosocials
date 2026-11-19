import { Injectable, Logger } from '@nestjs/common';
import { Client } from '@atproto/lex';
import {
  PasswordSession,
  type SessionData,
} from '@atproto/lex-password-session';
import { api } from '@bsky/sdk';
import { Platform } from '../../../../common/enums/platform.enum.js';
import { ProviderSessionsService } from '../../sessions/provider-sessions.service.js';
import type { BlueskyCredentialsDto } from './bluesky-credentials.dto.js';
import { isAuthFailure, toPlatformError } from './bluesky-errors.js';

export const DEFAULT_SERVICE = 'https://bsky.social';

export const serviceOf = (c: BlueskyCredentialsDto) =>
  (c.service ?? DEFAULT_SERVICE).replace(/\/$/, '');

/**
 * Owns Bluesky sessions: resumes the stored one, persists every refresh, and
 * only logs in with the app password when no valid session exists, because
 * createSession is tightly rate limited.
 */
@Injectable()
export class BlueskyClientFactory {
  private readonly logger = new Logger(BlueskyClientFactory.name);
  private readonly live = new Map<string, Promise<PasswordSession>>();

  constructor(private readonly store: ProviderSessionsService) {}

  keyOf(c: BlueskyCredentialsDto): string {
    return `bluesky:${serviceOf(c)}|${c.identifier.trim().toLowerCase()}`;
  }

  /** Runs `fn` with a logged-in client, logging in once more if the session was revoked. */
  async withClient<T>(
    c: BlueskyCredentialsDto,
    fn: (client: Client, session: PasswordSession) => Promise<T>,
  ): Promise<T> {
    try {
      const session = await this.session(c);
      return await fn(this.client(session), session);
    } catch (error) {
      if (!isAuthFailure(error)) throw toPlatformError(error);
      await this.forget(c);
      try {
        const session = await this.session(c, true);
        return await fn(this.client(session), session);
      } catch (retryError) {
        throw toPlatformError(retryError);
      }
    }
  }

  // Lexicon calls carry atproto-proxy to the AppView; record actions still go to the user's PDS.
  private client(session: PasswordSession): Client {
    return new Client(session, { service: api.app.service });
  }

  /** A brand-new login, used to prove an app password works. */
  async login(c: BlueskyCredentialsDto): Promise<PasswordSession> {
    await this.forget(c);
    return this.session(c, true).catch((e: unknown) =>
      Promise.reject(toPlatformError(e)),
    );
  }

  async logout(c: BlueskyCredentialsDto): Promise<void> {
    const key = this.keyOf(c);
    const data = await this.store.load<SessionData>(key);
    this.live.delete(key);
    await this.store.remove(key);
    if (data) await PasswordSession.delete(data).catch(() => undefined);
  }

  private session(
    c: BlueskyCredentialsDto,
    fresh = false,
  ): Promise<PasswordSession> {
    const key = this.keyOf(c);
    const cached = this.live.get(key);
    if (cached && !fresh) return cached;
    const created = this.open(c, key, fresh);
    this.live.set(key, created);
    created.catch(() => this.live.delete(key));
    return created;
  }

  private async open(
    c: BlueskyCredentialsDto,
    key: string,
    fresh: boolean,
  ): Promise<PasswordSession> {
    const hooks = {
      onUpdated: (data: SessionData) => {
        void this.store
          .save(key, Platform.Bluesky, data)
          .catch((e: unknown) =>
            this.logger.error(`Saving session failed: ${String(e)}`),
          );
      },
      onDeleted: () => {
        this.live.delete(key);
        void this.store.remove(key).catch(() => undefined);
      },
    };
    const stored = fresh ? null : await this.store.load<SessionData>(key);
    if (stored) {
      try {
        return await PasswordSession.resume(stored, hooks);
      } catch (error) {
        if (!isAuthFailure(error)) throw error;
        this.logger.log('Stored Bluesky session expired; logging in again');
      }
    }
    const session = await PasswordSession.login({
      service: serviceOf(c),
      identifier: c.identifier,
      password: c.appPassword,
      ...hooks,
    });
    await this.store.save(key, Platform.Bluesky, session.session);
    return session;
  }

  private async forget(c: BlueskyCredentialsDto): Promise<void> {
    const key = this.keyOf(c);
    this.live.delete(key);
    await this.store.remove(key);
  }
}
