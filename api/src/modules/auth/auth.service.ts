import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  PasswordHasher,
  RefreshTokenError,
  TokenService,
  type TokenPair,
} from '@nestjs/authentication';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { User } from '../users/entities/user.entity.js';
import { UsersService } from '../users/users.service.js';
import type { Workspace } from '../workspaces/entities/workspace.entity.js';
import { WorkspacesService } from '../workspaces/workspaces.service.js';
import type { AuthTokensDto, SignInDto, SignUpDto } from './dto/auth.dto.js';

const INVALID_CREDENTIALS = 'Incorrect email or password';

@Injectable()
export class AuthService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly users: UsersService,
    private readonly workspaces: WorkspacesService,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
  ) {}

  /** Creates the user and their first workspace together, then signs in. */
  async signUp(
    dto: SignUpDto,
  ): Promise<{ user: User; workspace: Workspace; tokens: AuthTokensDto }> {
    const passwordHash = await this.hasher.hash(dto.password);
    const { user, workspace } = await this.dataSource.transaction(async (m) => {
      const user = await this.users.create(m, {
        email: dto.email,
        name: dto.name,
        passwordHash,
      });
      const workspace = await this.workspaces.createOwned(
        m,
        user.id,
        dto.workspaceName ?? `${dto.name}'s workspace`,
      );
      return { user, workspace };
    });
    return { user, workspace, tokens: await this.issue(user.id) };
  }

  async signIn(dto: SignInDto): Promise<{ user: User; tokens: AuthTokensDto }> {
    const found = await this.users.findByEmailWithPassword(dto.email);
    // verify() checks a dummy hash when the user doesn't exist, so the
    // response time doesn't reveal which emails are registered.
    const valid = await this.hasher.verify(dto.password, found?.passwordHash);
    if (!found || !valid) throw new UnauthorizedException(INVALID_CREDENTIALS);

    if (this.hasher.needsRehash(found.passwordHash)) {
      await this.users.setPasswordHash(
        found.id,
        await this.hasher.hash(dto.password),
      );
    }
    await this.users.touchSignIn(found.id);
    const user = await this.users.findByIdOrFail(found.id);
    return { user, tokens: await this.issue(user.id) };
  }

  /** Rotates a refresh token. Reusing a spent one signs out that device. */
  async refresh(refreshToken: string): Promise<AuthTokensDto> {
    try {
      return this.toDto(await this.tokens.refresh(refreshToken));
    } catch (error) {
      if (error instanceof RefreshTokenError) {
        throw new UnauthorizedException(
          'Session expired. Please sign in again.',
        );
      }
      throw error;
    }
  }

  /** Signs out one device. Unknown tokens are ignored (RFC 7009). */
  async signOut(refreshToken: string): Promise<void> {
    await this.tokens.revoke(refreshToken);
  }

  /** Changes the password and signs out every other device. */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<AuthTokensDto> {
    const hash = await this.users.getPasswordHash(userId);
    if (!(await this.hasher.verify(currentPassword, hash))) {
      // 400, not 401: the session is fine, only the typed password is wrong,
      // and clients treat 401 as "signed out".
      throw new BadRequestException('Current password is incorrect');
    }
    await this.users.setPasswordHash(
      userId,
      await this.hasher.hash(newPassword),
    );
    await this.tokens.revokeAll(userId);
    return this.issue(userId);
  }

  private async issue(userId: string): Promise<AuthTokensDto> {
    return this.toDto(
      await this.tokens.issue(userId, {
        method: 'password',
        claims: { amr: ['pwd'] },
      }),
    );
  }

  private toDto(pair: TokenPair): AuthTokensDto {
    return {
      accessToken: pair.accessToken,
      refreshToken: pair.refreshToken,
      expiresIn: pair.expiresIn,
      tokenType: 'Bearer',
    };
  }
}
