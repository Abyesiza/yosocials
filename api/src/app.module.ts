import { Module } from '@nestjs/common';
import { AuthenticationModule } from '@nestjs/authentication';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { CryptoModule } from './common/crypto/crypto.module.js';
import { StorageModule } from './common/storage/storage.module.js';
import {
  type EnvironmentVariables,
  isServerless,
  validateEnv,
} from './config/env.validation.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthController } from './health.controller.js';
import { AccountsModule } from './modules/accounts/accounts.module.js';
import { AgentModule } from './modules/agent/agent.module.js';
import { AnalyticsModule } from './modules/analytics/analytics.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { FeedModule } from './modules/feed/feed.module.js';
import { IntegrationsModule } from './modules/integrations/integrations.module.js';
import { PostsModule } from './modules/posts/posts.module.js';
import { PublishingModule } from './modules/publishing/publishing.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { WorkspacesModule } from './modules/workspaces/workspaces.module.js';

const ISSUER = 'yo-socials-api';
const AUDIENCE = 'yo-socials';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    // Registers a global guard: every route needs a signed-in user unless
    // it is marked @Public().
    AuthenticationModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        accessToken: {
          key: Buffer.from(config.get('JWT_SECRET', { infer: true }), 'base64'),
          issuer: ISSUER,
          audience: AUDIENCE,
          ttl: '15m',
        },
        refreshToken: { ttl: '30d', absoluteTtl: '90d' },
      }),
    }),
    // No cron timers in a serverless function: it sleeps between requests.
    ...(isServerless() ? [] : [ScheduleModule.forRoot()]),
    DatabaseModule,
    CryptoModule,
    StorageModule,
    UsersModule,
    AuthModule,
    WorkspacesModule,
    IntegrationsModule,
    AccountsModule,
    PostsModule,
    PublishingModule,
    AnalyticsModule,
    FeedModule,
    AgentModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
