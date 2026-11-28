import {
  BadGatewayException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { plainToInstance, type ClassConstructor } from 'class-transformer';
import { validate } from 'class-validator';
import { AccountsService } from '../accounts/accounts.service.js';
import { IntegrationsRegistry } from '../integrations/integrations.registry.js';
import { PostResponseDto } from '../posts/dto/post-response.dto.js';
import { PostSource } from '../posts/enums/post-status.enum.js';
import { PostsService } from '../posts/posts.service.js';
import type {
  DraftVariantsDto,
  DraftVariantsResponseDto,
} from './dto/draft-variants.dto.js';
import {
  ModelCalendarOutput,
  ModelVariantsOutput,
} from './dto/model-output.dto.js';
import type {
  PlanCalendarDto,
  PlanCalendarResponseDto,
} from './dto/plan-calendar.dto.js';
import {
  LANGUAGE_MODEL,
  type LanguageModel,
} from './interfaces/language-model.interface.js';
import {
  type AccountContext,
  CALENDAR_SCHEMA,
  calendarPrompt,
  SYSTEM_PROMPT,
  VARIANTS_SCHEMA,
  variantsPrompt,
} from './prompts/prompts.js';

/** Earliest a planned post may go out, from now. */
const MIN_LEAD_MS = 10 * 60_000;

/**
 * The planning agent. It only ever creates drafts: nothing it writes is
 * published until a person schedules or publishes it.
 */
@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    @Inject(LANGUAGE_MODEL) private readonly model: LanguageModel,
    private readonly accounts: AccountsService,
    private readonly posts: PostsService,
    private readonly registry: IntegrationsRegistry,
  ) {}

  async planCalendar(
    workspaceId: string,
    dto: PlanCalendarDto,
  ): Promise<PlanCalendarResponseDto> {
    const contexts = await this.loadContexts(workspaceId, dto.accountIds);
    const byId = new Map(contexts.map((c) => [c.account.id, c]));
    // Never plan into the past: a window starting "today" begins at midnight,
    // and an approved past time would publish the moment it's scheduled.
    const start = new Date(
      Math.max(dto.startDate.getTime(), Date.now() + MIN_LEAD_MS),
    );
    const end = new Date(dto.startDate.getTime() + dto.days * 86_400_000);

    const output = await this.ask(ModelCalendarOutput, {
      prompt: calendarPrompt({
        brief: dto.brief,
        accounts: contexts,
        start,
        end,
        timezone: dto.timezone,
        postsPerWeekPerAccount: dto.postsPerWeekPerAccount,
      }),
      jsonSchema: CALENDAR_SCHEMA,
    });

    const skipped: string[] = [];
    const created: PostResponseDto[] = [];

    for (const planned of output.posts) {
      const seen = new Set<string>();
      const targets = planned.targets.filter((t) => {
        const ctx = byId.get(t.accountId);
        const when = new Date(t.scheduledAt);
        const reason = !ctx
          ? 'the AI picked an account that isn’t in this plan'
          : seen.has(t.accountId)
            ? 'the AI suggested this account twice'
            : when < start || when > end
              ? 'the suggested time is outside the dates you chose'
              : this.posts.textLengthIssue(t.text, ctx.account);
        if (reason) {
          skipped.push(
            `“${planned.title}” for ${ctx?.platformName ?? 'an account'}: ${reason}`,
          );
          return false;
        }
        seen.add(t.accountId);
        return true;
      });
      if (targets.length === 0) continue;

      const post = await this.posts.create(
        workspaceId,
        {
          title: planned.title,
          body: planned.idea,
          targets: targets.map((t) => ({
            accountId: t.accountId,
            text: t.text,
            scheduledAt: new Date(t.scheduledAt),
          })),
        },
        { source: PostSource.Agent, asDraft: true },
      );
      created.push(this.posts.respond(post));
    }

    this.logger.log(
      `Planned ${created.length} post(s), skipped ${skipped.length} suggestion(s)`,
    );
    return { model: this.model.modelName, posts: created, skipped };
  }

  async draftVariants(
    workspaceId: string,
    dto: DraftVariantsDto,
  ): Promise<DraftVariantsResponseDto> {
    const contexts = await this.loadContexts(workspaceId, dto.accountIds);
    const output = await this.ask(ModelVariantsOutput, {
      prompt: variantsPrompt(dto.idea, contexts),
      jsonSchema: VARIANTS_SCHEMA,
    });

    const variants = contexts.flatMap(({ account }) => {
      const variant = output.variants.find((v) => v.accountId === account.id);
      if (!variant) return [];
      return [
        {
          accountId: account.id,
          platform: account.platform,
          text: variant.text,
          fits: this.posts.textLengthIssue(variant.text, account) === null,
        },
      ];
    });
    return { model: this.model.modelName, variants };
  }

  private async loadContexts(
    workspaceId: string,
    accountIds: string[],
  ): Promise<AccountContext[]> {
    const accounts = await this.accounts.findMany(workspaceId, accountIds);
    return accounts.map((account) => {
      const provider = this.registry.get(account.platform);
      return {
        account,
        platformName: provider.displayName,
        capabilities: provider.capabilities,
      };
    });
  }

  /** Calls the model and validates its JSON against an output DTO. */
  private async ask<T extends object>(
    dto: ClassConstructor<T>,
    request: { prompt: string; jsonSchema: Record<string, unknown> },
  ): Promise<T> {
    const raw = await this.model.generateJson({
      system: SYSTEM_PROMPT,
      ...request,
    });
    const instance = plainToInstance(dto, raw);
    const errors = await validate(instance);
    if (errors.length > 0) {
      this.logger.warn(`Model output failed validation: ${errors.toString()}`);
      throw new BadGatewayException(
        'Our AI gave an answer we couldn’t use. Try again.',
      );
    }
    return instance;
  }
}
