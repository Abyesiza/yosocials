import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module.js';
import { IntegrationsModule } from '../integrations/integrations.module.js';
import { PostsModule } from '../posts/posts.module.js';
import { AgentController } from './agent.controller.js';
import { AgentService } from './agent.service.js';
import { GeminiLanguageModel } from './gemini/gemini-language-model.js';
import { LANGUAGE_MODEL } from './interfaces/language-model.interface.js';

@Module({
  imports: [AccountsModule, PostsModule, IntegrationsModule],
  controllers: [AgentController],
  providers: [
    AgentService,
    { provide: LANGUAGE_MODEL, useClass: GeminiLanguageModel },
  ],
})
export class AgentModule {}
