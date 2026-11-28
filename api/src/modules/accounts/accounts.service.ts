import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import type { Platform } from '../../common/enums/platform.enum.js';
import { CryptoService } from '../../common/crypto/crypto.service.js';
import { PlatformApiError } from '../../common/http/http-client.js';
import type {
  OAuthConnector,
  PlatformProvider,
  VerifiedAccount,
} from '../integrations/interfaces/platform-provider.interface.js';
import { IntegrationsRegistry } from '../integrations/integrations.registry.js';
import type { ConnectAccountDto } from './dto/connect-account.dto.js';
import type { UpdateAccountDto } from './dto/update-account.dto.js';
import { SocialAccount } from './entities/social-account.entity.js';
import type { AccountPersona } from './enums/account-persona.enum.js';
import { AccountStatus } from './enums/account-status.enum.js';
import { OAuthStateService } from './oauth-state.service.js';

/**
 * Every public method takes the workspace first and only ever touches that
 * workspace's accounts. `getCredentials` and `recordFailure` are for the
 * background jobs, which work across workspaces by account id.
 */
@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(SocialAccount)
    private readonly accounts: Repository<SocialAccount>,
    private readonly registry: IntegrationsRegistry,
    private readonly crypto: CryptoService,
    private readonly states: OAuthStateService,
  ) {}

  /**
   * Validates and verifies the credentials against the platform, then stores
   * them encrypted. Reconnecting the same platform account updates it in place.
   */
  async connect(
    workspaceId: string,
    dto: ConnectAccountDto,
  ): Promise<SocialAccount> {
    const provider = this.registry.get(dto.platform);
    const credentials = await provider.parseCredentials(dto.credentials);
    const verified = await this.verifyOrReject(
      () => provider.verify(credentials),
      `${provider.displayName} didn’t accept these details`,
    );
    return this.save(workspaceId, dto.platform, credentials, verified, dto);
  }

  /** Starts an OAuth sign-in: where to send the user, and the state to expect back. */
  startOAuth(
    ctx: { workspaceId: string; userId: string },
    platform: Platform,
  ): { url: string; state: string } {
    const oauth = this.oauthOf(this.registry.get(platform));
    const state = this.states.sign({ ...ctx, platform });
    return {
      url: oauth.authorizeUrl(state, this.states.codeVerifier(state)),
      state,
    };
  }

  /** Finishes an OAuth sign-in and connects (or reconnects) the account. */
  async finishOAuth(
    ctx: { workspaceId: string; userId: string },
    platform: Platform,
    code: string,
    state: string,
  ): Promise<SocialAccount> {
    const provider = this.registry.get(platform);
    const oauth = this.oauthOf(provider);
    this.states.verify(state, { ...ctx, platform });
    const rejected = `${provider.displayName} didn’t accept the sign-in`;
    const credentials = await this.verifyOrReject(
      () => oauth.exchange(code, this.states.codeVerifier(state)),
      rejected,
    );
    const verified = await this.verifyOrReject(
      () => provider.verify(credentials),
      rejected,
    );
    return this.save(ctx.workspaceId, platform, credentials, verified, {});
  }

  /** Live account details a platform needs shown before posting (TikTok). */
  async creatorInfo(workspaceId: string, id: string): Promise<object> {
    const account = await this.findOne(workspaceId, id);
    const provider = this.registry.get(account.platform);
    if (!provider.creatorInfo) {
      throw new NotFoundException(
        `${provider.displayName} doesn’t share account details before posting.`,
      );
    }
    try {
      return await provider.creatorInfo(await this.getCredentials(id));
    } catch (error) {
      await this.recordFailure(account, error);
      if (error instanceof PlatformApiError && !error.retryable) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  private async save(
    workspaceId: string,
    platform: Platform,
    credentials: object,
    verified: VerifiedAccount,
    profile: { persona?: AccountPersona; voice?: string },
  ): Promise<SocialAccount> {
    const existing = await this.accounts.findOneBy({
      workspaceId,
      platform,
      externalId: verified.externalId,
    });
    const account = existing ?? this.accounts.create({ workspaceId });

    Object.assign(account, {
      platform,
      externalId: verified.externalId,
      handle: verified.handle,
      displayName: verified.displayName,
      profileUrl: verified.profileUrl ?? null,
      avatarUrl: verified.avatarUrl ?? null,
      persona: profile.persona ?? account.persona,
      voice: profile.voice ?? account.voice ?? null,
      status: AccountStatus.Active,
      lastError: null,
      encryptedCredentials: this.crypto.encryptJson(credentials),
    });
    const saved = await this.accounts.save(account);
    return this.findOne(workspaceId, saved.id);
  }

  private oauthOf(provider: PlatformProvider): OAuthConnector {
    if (!provider.oauth) {
      throw new BadRequestException(
        `${provider.displayName} connects with details from its settings, not a sign-in.`,
      );
    }
    if (!provider.oauth.isConfigured()) {
      throw new ServiceUnavailableException(
        `${provider.displayName} isn’t available yet. Ask whoever runs Aby Socials to finish setting it up.`,
      );
    }
    return provider.oauth;
  }

  findAll(workspaceId: string): Promise<SocialAccount[]> {
    return this.accounts.find({
      where: { workspaceId },
      order: { createdAt: 'ASC' },
    });
  }

  async findOne(workspaceId: string, id: string): Promise<SocialAccount> {
    const account = await this.accounts.findOneBy({ id, workspaceId });
    if (!account)
      throw new NotFoundException(
        'We couldn’t find that account in this workspace.',
      );
    return account;
  }

  /** All of `ids`, which must belong to the workspace. */
  async findMany(workspaceId: string, ids: string[]): Promise<SocialAccount[]> {
    const unique = [...new Set(ids)];
    const found = await this.accounts.findBy({ id: In(unique), workspaceId });
    const missing = unique.filter((id) => !found.some((a) => a.id === id));
    if (missing.length > 0) {
      throw new NotFoundException(
        'We couldn’t find some of those accounts in this workspace. Refresh the page and try again.',
      );
    }
    return found;
  }

  async update(
    workspaceId: string,
    id: string,
    dto: UpdateAccountDto,
  ): Promise<SocialAccount> {
    const account = await this.findOne(workspaceId, id);
    if (dto.persona !== undefined) account.persona = dto.persona;
    if (dto.voice !== undefined) account.voice = dto.voice;
    return this.accounts.save(account);
  }

  /** Re-checks stored credentials and refreshes profile details. */
  async reverify(workspaceId: string, id: string): Promise<SocialAccount> {
    const account = await this.findOne(workspaceId, id);
    const provider = this.registry.get(account.platform);
    const credentials = await this.getCredentials(id);
    try {
      const verified = await provider.verify(credentials);
      Object.assign(account, {
        handle: verified.handle,
        displayName: verified.displayName,
        profileUrl: verified.profileUrl ?? null,
        avatarUrl: verified.avatarUrl ?? null,
        status: AccountStatus.Active,
        lastError: null,
      });
    } catch (error) {
      await this.recordFailure(account, error);
      if (error instanceof PlatformApiError && !error.retryable) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
    return this.accounts.save(account);
  }

  async remove(workspaceId: string, id: string): Promise<void> {
    const account = await this.findOne(workspaceId, id);
    const provider = this.registry.get(account.platform);
    // Another workspace may use the same platform account and its session.
    const shared = await this.accounts.existsBy({
      id: Not(account.id),
      platform: account.platform,
      externalId: account.externalId,
    });
    if (!shared) {
      // Best effort: end the platform session so its tokens don't outlive the account.
      await provider
        .disconnect?.(await this.getCredentials(id))
        .catch(() => undefined);
    }
    await this.accounts.remove(account);
  }

  /** Decrypted credentials, for providers only. Never return these to clients. */
  async getCredentials(id: string): Promise<object> {
    const row = await this.accounts
      .createQueryBuilder('a')
      .addSelect('a.encryptedCredentials')
      .where('a.id = :id', { id })
      .getOne();
    if (!row)
      throw new NotFoundException(
        'We couldn’t find that account in this workspace.',
      );
    return this.crypto.decryptJson<object>(row.encryptedCredentials);
  }

  /** Marks the account for reconnecting when the platform rejected its auth. */
  async recordFailure(account: SocialAccount, error: unknown): Promise<void> {
    if (
      error instanceof PlatformApiError &&
      (error.status === 401 || error.status === 403)
    ) {
      account.status = AccountStatus.NeedsReconnect;
      account.lastError = error.message;
      await this.accounts.update(account.id, {
        status: account.status,
        lastError: account.lastError,
      });
    }
  }

  private async verifyOrReject<T>(
    call: () => Promise<T>,
    rejected = 'The platform didn’t accept these details',
  ): Promise<T> {
    try {
      return await call();
    } catch (error) {
      if (error instanceof PlatformApiError && !error.retryable) {
        throw new BadRequestException(`${rejected}: ${error.message}`);
      }
      throw error;
    }
  }
}
