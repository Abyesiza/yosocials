import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module.js';
import { WorkspaceMember } from './entities/workspace-member.entity.js';
import { Workspace } from './entities/workspace.entity.js';
import { WorkspaceAccessGuard } from './guards/workspace-access.guard.js';
import {
  WorkspaceController,
  WorkspacesController,
} from './workspaces.controller.js';
import { WorkspacesService } from './workspaces.service.js';

/**
 * Import this module wherever a controller uses @WorkspaceScoped(): the
 * guard it applies needs WorkspacesService.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Workspace, WorkspaceMember]),
    UsersModule,
  ],
  controllers: [WorkspacesController, WorkspaceController],
  providers: [WorkspacesService, WorkspaceAccessGuard],
  exports: [WorkspacesService, WorkspaceAccessGuard],
})
export class WorkspacesModule {}
