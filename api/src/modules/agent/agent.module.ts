import { Module } from '@nestjs/common';
import { WorkspacesModule } from '../workspaces/workspaces.module.js';
import { AccountsModule } from '../accounts/accounts.module.js';
import { IntegrationsModule } from '../integrations/integrations.module.js';
import { PostsModule } from '../posts/posts.module.js';
import { SchedulingModule } from '../scheduling/scheduling.module.js';
import { TrendsModule } from '../trends/trends.module.js';
import { AgentController } from './agent.controller.js';
import { AgentService } from './agent.service.js';
import { GeminiLanguageModel } from './gemini/gemini-language-model.js';
import { LANGUAGE_MODEL } from './interfaces/language-model.interface.js';

@Module({
  imports: [
    WorkspacesModule,
    AccountsModule,
    PostsModule,
    IntegrationsModule,
    SchedulingModule,
    TrendsModule,
  ],
  controllers: [AgentController],
  providers: [
    AgentService,
    { provide: LANGUAGE_MODEL, useClass: GeminiLanguageModel },
  ],
})
export class AgentModule {}
