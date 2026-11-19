import './authentication.types.js';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountsModule } from '../accounts/accounts.module.js';
import { UsersModule } from '../users/users.module.js';
import { WorkspacesModule } from '../workspaces/workspaces.module.js';
import { AuthController, MeController } from './auth.controller.js';
import { AccountDeletionService } from './account-deletion.service.js';
import { AuthService } from './auth.service.js';
import { RefreshToken } from './entities/refresh-token.entity.js';
import { RevokedTokenFamily } from './entities/revoked-token-family.entity.js';
import { JwtAuthProvider } from './providers/jwt-auth.provider.js';
import { TypeOrmRefreshTokenStore } from './stores/typeorm-refresh-token.store.js';

/**
 * App side of authentication. The package side (global guard, TokenService,
 * PasswordHasher) is configured by AuthenticationModule in AppModule; the
 * provider and store here register themselves with it.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([RefreshToken, RevokedTokenFamily]),
    UsersModule,
    WorkspacesModule,
    AccountsModule,
  ],
  controllers: [AuthController, MeController],
  providers: [
    AuthService,
    AccountDeletionService,
    JwtAuthProvider,
    TypeOrmRefreshTokenStore,
  ],
})
export class AuthModule {}
