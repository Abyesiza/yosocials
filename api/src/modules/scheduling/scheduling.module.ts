import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountsModule } from '../accounts/accounts.module.js';
import { IntegrationsModule } from '../integrations/integrations.module.js';
import { PostTarget } from '../posts/entities/post-target.entity.js';
import { WorkspacesModule } from '../workspaces/workspaces.module.js';
import { SchedulingController } from './scheduling.controller.js';
import { SchedulingService } from './scheduling.service.js';

@Module({
  imports: [
    WorkspacesModule,
    TypeOrmModule.forFeature([PostTarget]),
    AccountsModule,
    IntegrationsModule,
  ],
  controllers: [SchedulingController],
  providers: [SchedulingService],
  exports: [SchedulingService],
})
export class SchedulingModule {}
