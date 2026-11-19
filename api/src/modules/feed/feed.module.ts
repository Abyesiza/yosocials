import { Module } from '@nestjs/common';
import { WorkspacesModule } from '../workspaces/workspaces.module.js';
import { PostsModule } from '../posts/posts.module.js';
import { FeedController } from './feed.controller.js';
import { FeedService } from './feed.service.js';

@Module({
  imports: [WorkspacesModule, PostsModule],
  controllers: [FeedController],
  providers: [FeedService],
})
export class FeedModule {}
