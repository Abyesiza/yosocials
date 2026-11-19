import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module.js';
import { AnalyticsModule } from '../analytics/analytics.module.js';
import { IntegrationsModule } from '../integrations/integrations.module.js';
import { PostsModule } from '../posts/posts.module.js';
import { PublishingController } from './publishing.controller.js';
import { PublishingScheduler } from './publishing.scheduler.js';
import { PublishingService } from './publishing.service.js';

@Module({
  imports: [PostsModule, AccountsModule, IntegrationsModule, AnalyticsModule],
  controllers: [PublishingController],
  providers: [PublishingService, PublishingScheduler],
})
export class PublishingModule {}
