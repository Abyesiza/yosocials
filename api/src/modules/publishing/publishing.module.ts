import { Module } from '@nestjs/common';
import { WorkspacesModule } from '../workspaces/workspaces.module.js';
import { AccountsModule } from '../accounts/accounts.module.js';
import { AnalyticsModule } from '../analytics/analytics.module.js';
import { IntegrationsModule } from '../integrations/integrations.module.js';
import { PostsModule } from '../posts/posts.module.js';
import { SchedulingModule } from '../scheduling/scheduling.module.js';
import { PublishingController } from './publishing.controller.js';
import { PublishingScheduler } from './publishing.scheduler.js';
import { PublishingService } from './publishing.service.js';

@Module({
  imports: [
    WorkspacesModule,
    PostsModule,
    AccountsModule,
    IntegrationsModule,
    AnalyticsModule,
    SchedulingModule,
  ],
  controllers: [PublishingController],
  providers: [PublishingService, PublishingScheduler],
})
export class PublishingModule {}
