import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { CryptoModule } from './common/crypto/crypto.module.js';
import { validateEnv } from './config/env.validation.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthController } from './health.controller.js';
import { AccountsModule } from './modules/accounts/accounts.module.js';
import { AgentModule } from './modules/agent/agent.module.js';
import { AnalyticsModule } from './modules/analytics/analytics.module.js';
import { FeedModule } from './modules/feed/feed.module.js';
import { IntegrationsModule } from './modules/integrations/integrations.module.js';
import { PostsModule } from './modules/posts/posts.module.js';
import { PublishingModule } from './modules/publishing/publishing.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    CryptoModule,
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
