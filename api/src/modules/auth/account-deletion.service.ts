import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PasswordHasher, TokenService } from '@nestjs/authentication';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccountsService } from '../accounts/accounts.service.js';
import { UsersService } from '../users/users.service.js';
import { WorkspaceRole } from '../workspaces/enums/workspace-role.enum.js';
import { WorkspacesService } from '../workspaces/workspaces.service.js';
import { RefreshToken } from './entities/refresh-token.entity.js';

/**
 * Deletes a user and everything only they own. Workspaces shared with others
 * are never deleted: the user must hand over ownership first.
 */
@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger(AccountDeletionService.name);

  constructor(
    private readonly users: UsersService,
    private readonly workspaces: WorkspacesService,
    private readonly accounts: AccountsService,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokens: Repository<RefreshToken>,
  ) {}

  async deleteAccount(userId: string, password: string): Promise<void> {
    const hash = await this.users.getPasswordHash(userId);
    if (!(await this.hasher.verify(password, hash))) {
      throw new BadRequestException('That password doesn’t match. Try again.');
    }

    const soleWorkspaces = await this.workspacesToDelete(userId);
    for (const workspaceId of soleWorkspaces) {
      // Disconnect first so platform sessions (e.g. Bluesky) are logged out, not orphaned.
      for (const account of await this.accounts.findAll(workspaceId)) {
        await this.accounts.remove(workspaceId, account.id);
      }
      await this.workspaces.remove(workspaceId);
    }

    await this.tokens.revokeAll(userId);
    await this.refreshTokens.delete({ userId });
    await this.users.remove(userId);
    this.logger.log(`Deleted a user and ${soleWorkspaces.length} workspace(s)`);
  }

  /** Workspaces where the user is the only member; throws if any would be left ownerless. */
  private async workspacesToDelete(userId: string): Promise<string[]> {
    const toDelete: string[] = [];
    const blocked: string[] = [];
    for (const membership of await this.workspaces.listForUser(userId)) {
      if (membership.role !== WorkspaceRole.Owner) continue;
      const others = (
        await this.workspaces.listMembers(membership.workspaceId)
      ).filter((m) => m.userId !== userId);
      if (others.length === 0) toDelete.push(membership.workspaceId);
      else if (!others.some((m) => m.role === WorkspaceRole.Owner))
        blocked.push(membership.workspace.name);
    }
    if (blocked.length > 0) {
      throw new ConflictException(
        `Make someone else an owner of ${blocked.join(', ')} (or delete ${blocked.length > 1 ? 'those workspaces' : 'it'}) before deleting your account.`,
      );
    }
    return toDelete;
  }
}
