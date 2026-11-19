import { Module } from '@nestjs/common';
import { WorkspacesModule } from '../workspaces/workspaces.module.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountsModule } from '../accounts/accounts.module.js';
import { IntegrationsModule } from '../integrations/integrations.module.js';
import { PostsModule } from '../posts/posts.module.js';
import { AnalyticsController } from './analytics.controller.js';
import { AnalyticsService } from './analytics.service.js';
import { PostMetricSnapshot } from './entities/post-metric-snapshot.entity.js';

@Module({
  imports: [
    WorkspacesModule,
    TypeOrmModule.forFeature([PostMetricSnapshot]),
    PostsModule,
    AccountsModule,
    IntegrationsModule,
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
