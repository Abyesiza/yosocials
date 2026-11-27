import { Module } from '@nestjs/common';
import { WorkspacesModule } from '../workspaces/workspaces.module.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountsModule } from '../accounts/accounts.module.js';
import { IntegrationsModule } from '../integrations/integrations.module.js';
import { PostTarget } from './entities/post-target.entity.js';
import { Post } from './entities/post.entity.js';
import { MediaController } from './media.controller.js';
import { PostsController } from './posts.controller.js';
import { PostsService } from './posts.service.js';

@Module({
  imports: [
    WorkspacesModule,
    TypeOrmModule.forFeature([Post, PostTarget]),
    AccountsModule,
    IntegrationsModule,
  ],
  controllers: [PostsController, MediaController],
  providers: [PostsService],
  exports: [PostsService, TypeOrmModule],
})
export class PostsModule {}
