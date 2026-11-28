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
import { SchedulingService } from '../scheduling/scheduling.service.js';
import { TrendsService } from '../trends/trends.service.js';
import type { TrendSnapshot } from '../trends/trends.types.js';
import type { Slot } from '../scheduling/slot-finder.js';
import { describeDay, localTime } from '../scheduling/time-zone.js';
import type {
  DraftVariantsDto,
  DraftVariantsResponseDto,
} from './dto/draft-variants.dto.js';
import {
  ModelCalendarOutput,
  type ModelPostOutput,
  type ModelTargetOutput,
  ModelVariantsOutput,
} from './dto/model-output.dto.js';
import type {
  PlanCalendarDto,
  PlanCalendarResponseDto,
} from './dto/plan-calendar.dto.js';
import {
  type GroundingInfo,
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
    private readonly scheduling: SchedulingService,
    private readonly trends: TrendsService,
  ) {}

  capabilities(): { model: string; searchWeb: boolean } {
    return { model: this.model.modelName, searchWeb: this.model.canSearchWeb };
  }

  async planCalendar(
    workspaceId: string,
    dto: PlanCalendarDto,
  ): Promise<PlanCalendarResponseDto> {
    const contexts = await this.loadContexts(workspaceId, dto.accountIds);
    const byId = new Map(contexts.map((c) => [c.account.id, c]));
    const audience = await this.scheduling.audience(workspaceId);
    const timeZone = dto.timezone ?? audience.timeZone;
    // Never plan into the past: a window starting "today" begins at midnight,
    // and an approved past time would publish the moment it's scheduled.
    const start = new Date(
      Math.max(dto.startDate.getTime(), Date.now() + MIN_LEAD_MS),
    );
    const end = new Date(dto.startDate.getTime() + dto.days * 86_400_000);
    const firstDay = localTime(start, timeZone).day;
    const lastDay = localTime(new Date(end.getTime() - 1), timeZone).day;

    const country = dto.country ?? audience.country;
    // Shared, cached public trend lists; never Gemini's grounded output (Google's terms).
    const trends: TrendSnapshot | null =
      dto.useTrends && country ? await this.trends.forCountry(country) : null;

    const { output, grounding } = await this.askGrounded(
      ModelCalendarOutput,
      {
        prompt: calendarPrompt({
          brief: dto.brief,
          accounts: contexts,
          firstDay,
          lastDay,
          timeZone,
          country,
          postsPerWeekPerAccount: dto.postsPerWeekPerAccount,
          ...(trends?.items.length && { trends: this.trends.digest(trends) }),
        }),
        jsonSchema: CALENDAR_SCHEMA,
      },
      dto.searchWeb,
    );

    const skipped: string[] = [];
    const skip = (
      title: string,
      ctx: AccountContext | undefined,
      why: string,
    ) =>
      skipped.push(
        `“${title}” for ${ctx?.platformName ?? 'an account'}: ${why}`,
      );

    const planned = output.posts.map((post) => {
      const seen = new Set<string>();
      const targets = post.targets.filter((t) => {
        const ctx = byId.get(t.accountId);
        const reason = !ctx
          ? 'the AI picked an account that isn’t in this plan'
          : seen.has(t.accountId)
            ? 'the AI suggested this account twice'
            : t.date < firstDay || t.date > lastDay
              ? 'the suggested date is outside the dates you chose'
              : this.posts.textLengthIssue(t.text, ctx.account);
        if (reason) {
          skip(post.title, ctx, reason);
          return false;
        }
        seen.add(t.accountId);
        return true;
      });
      return { post, targets };
    });
    const slots = await this.assignTimes(
      planned,
      contexts,
      { timeZone, start, end },
      skip,
    );

    const created: PostResponseDto[] = [];
    for (const { post, targets } of planned) {
      const timed = targets.filter((t) => slots.has(t));
      if (timed.length === 0) continue;
      const saved = await this.posts.create(
        workspaceId,
        {
          title: post.title,
          body: post.idea,
          targets: timed.map((t) => ({
            accountId: t.accountId,
            text: t.text,
            scheduledAt: slots.get(t)!.at,
          })),
        },
        {
          source: PostSource.Agent,
          asDraft: true,
          scheduleReasons: new Map(
            timed.map((t) => [t.accountId, slots.get(t)!.reason]),
          ),
        },
      );
      created.push(this.posts.respond(saved));
    }

    this.logger.log(
      `Planned ${created.length} post(s), skipped ${skipped.length} suggestion(s)`,
    );
    return {
      model: this.model.modelName,
      timeZone,
      posts: created,
      skipped,
      trends,
      grounding,
    };
  }

  /**
   * Gives each target the account's best free time on or after the model's
   * date, earliest dates first, within caps and spacing (existing posts too).
   */
  private async assignTimes(
    planned: { post: ModelPostOutput; targets: ModelTargetOutput[] }[],
    contexts: AccountContext[],
    window: { timeZone: string; start: Date; end: Date },
    skip: (title: string, ctx: AccountContext, why: string) => void,
  ): Promise<Map<ModelTargetOutput, Slot>> {
    const { timeZone, start, end } = window;
    const byId = new Map(contexts.map((c) => [c.account.id, c]));
    const finders = await this.scheduling.finders(
      contexts.map((c) => c.account),
      timeZone,
      start,
      end,
    );
    const slots = new Map<ModelTargetOutput, Slot>();
    const queue = planned
      .flatMap(({ post, targets }) => targets.map((t) => ({ post, t })))
      .sort((a, b) => a.t.date.localeCompare(b.t.date));
    for (const { post, t } of queue) {
      const slot = finders.get(t.accountId)!.next(start, end, t.date);
      if (slot) {
        slots.set(t, slot);
        continue;
      }
      const ctx = byId.get(t.accountId)!;
      skip(
        post.title,
        ctx,
        `there’s no free time from ${describeDay(t.date)} to the end of the plan. We post to ${ctx.platformName} ${this.scheduling.ruleSummary(ctx.account)}.`,
      );
    }
    return slots;
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
    return (await this.askGrounded(dto, request, false)).output;
  }

  /** Searches the web first when asked and switched on; otherwise a plain request. */
  private async askGrounded<T extends object>(
    dto: ClassConstructor<T>,
    request: { prompt: string; jsonSchema: Record<string, unknown> },
    searchWeb: boolean,
  ): Promise<{ output: T; grounding: GroundingInfo | null }> {
    const full = { system: SYSTEM_PROMPT, ...request };
    const { data: raw, grounding } =
      searchWeb && this.model.canSearchWeb
        ? await this.model.generateGrounded(full)
        : { data: await this.model.generateJson(full), grounding: null };
    return { output: await this.validated(dto, raw), grounding };
  }

  private async validated<T extends object>(
    dto: ClassConstructor<T>,
    raw: unknown,
  ): Promise<T> {
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
