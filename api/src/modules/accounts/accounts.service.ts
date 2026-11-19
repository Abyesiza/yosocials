import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CryptoService } from '../../common/crypto/crypto.service.js';
import { PlatformApiError } from '../../common/http/http-client.js';
import { IntegrationsRegistry } from '../integrations/integrations.registry.js';
import type { ConnectAccountDto } from './dto/connect-account.dto.js';
import type { UpdateAccountDto } from './dto/update-account.dto.js';
import { SocialAccount } from './entities/social-account.entity.js';
import { AccountStatus } from './enums/account-status.enum.js';

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
    const verified = await this.verifyOrReject(() =>
      provider.verify(credentials),
    );

    const existing = await this.accounts.findOneBy({
      workspaceId,
      platform: dto.platform,
      externalId: verified.externalId,
    });
    const account = existing ?? this.accounts.create({ workspaceId });

    Object.assign(account, {
      platform: dto.platform,
      externalId: verified.externalId,
      handle: verified.handle,
      displayName: verified.displayName,
      profileUrl: verified.profileUrl ?? null,
      avatarUrl: verified.avatarUrl ?? null,
      persona: dto.persona ?? account.persona,
      voice: dto.voice ?? account.voice ?? null,
      status: AccountStatus.Active,
      lastError: null,
      encryptedCredentials: this.crypto.encryptJson(credentials),
    });
    const saved = await this.accounts.save(account);
    return this.findOne(workspaceId, saved.id);
  }

  findAll(workspaceId: string): Promise<SocialAccount[]> {
    return this.accounts.find({
      where: { workspaceId },
      order: { createdAt: 'ASC' },
    });
  }

  async findOne(workspaceId: string, id: string): Promise<SocialAccount> {
    const account = await this.accounts.findOneBy({ id, workspaceId });
    if (!account) throw new NotFoundException(`Account ${id} not found`);
    return account;
  }

  /** All of `ids`, which must belong to the workspace. */
  async findMany(workspaceId: string, ids: string[]): Promise<SocialAccount[]> {
    const unique = [...new Set(ids)];
    const found = await this.accounts.findBy({ id: In(unique), workspaceId });
    const missing = unique.filter((id) => !found.some((a) => a.id === id));
    if (missing.length > 0) {
      throw new NotFoundException(`Accounts not found: ${missing.join(', ')}`);
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
      throw error;
    }
    return this.accounts.save(account);
  }

  async remove(workspaceId: string, id: string): Promise<void> {
    const account = await this.findOne(workspaceId, id);
    const provider = this.registry.get(account.platform);
    // Best effort: end the platform session so its tokens don't outlive the account.
    await provider
      .disconnect?.(await this.getCredentials(id))
      .catch(() => undefined);
    await this.accounts.remove(account);
  }

  /** Decrypted credentials, for providers only. Never return these to clients. */
  async getCredentials(id: string): Promise<object> {
    const row = await this.accounts
      .createQueryBuilder('a')
      .addSelect('a.encryptedCredentials')
      .where('a.id = :id', { id })
      .getOne();
    if (!row) throw new NotFoundException(`Account ${id} not found`);
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

  private async verifyOrReject<T>(call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (error) {
      if (error instanceof PlatformApiError && !error.retryable) {
        throw new BadRequestException(
          `The platform rejected these credentials: ${error.message}`,
        );
      }
      throw error;
    }
  }
}
