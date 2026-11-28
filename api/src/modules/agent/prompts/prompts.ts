import { TREND_GUIDANCE } from '../../trends/trend-guidance.js';
import type { SocialAccount } from '../../accounts/entities/social-account.entity.js';
import type { ProviderCapabilities } from '../../integrations/interfaces/platform-provider.interface.js';

export interface AccountContext {
  account: SocialAccount;
  platformName: string;
  capabilities: ProviderCapabilities;
}

export const SYSTEM_PROMPT = `You are Aby Socials, a social media strategist and copywriter.
You plan and write posts for the accounts you are given. Rules:
- Write natively for each platform: respect its length limit and style. Never exceed a limit.
- Match each account's persona and brand voice.
- Do not invent facts, statistics, prices, dates or quotes that are not in the brief.
- Only include links, @mentions and URLs that appear in the brief. Never make up a link (no example.com).
- No hashtag stuffing: at most 3 relevant hashtags, and only where the platform uses them.
- Return only JSON matching the schema.`;

function describeAccounts(
  accounts: AccountContext[],
  withPosting = false,
): string {
  return accounts
    .map(({ account, platformName, capabilities }) =>
      [
        `- accountId: ${account.id}`,
        `  platform: ${platformName} (${account.handle})`,
        `  persona: ${account.persona}`,
        `  voice: ${account.voice ?? 'not specified'}`,
        `  max length: ${capabilities.maxTextLength} ${capabilities.lengthUnit}`,
        `  style: ${capabilities.contentStyle}`,
        ...(withPosting
          ? [
              `  posting limit: at most ${capabilities.posting.maxPerDay} post(s) a day, at least ${capabilities.posting.minSpacingMinutes} minutes apart`,
            ]
          : []),
      ].join('\n'),
    )
    .join('\n');
}

export interface CalendarPromptInput {
  brief: string;
  accounts: AccountContext[];
  /** First and last audience-local day of the plan, "YYYY-MM-DD". */
  firstDay: string;
  lastDay: string;
  timeZone: string;
  /** ISO 3166-1 alpha-2, or null when the workspace hasn't set one. */
  country: string | null;
  postsPerWeekPerAccount: number;
  /** What's trending for the audience (TrendsService.digest), when used. */
  trends?: string;
}

/** Platform-specific trend advice (e.g. TikTok sounds) for the platforms in this plan. */
function trendGuidance(accounts: AccountContext[]): string {
  const platforms = [...new Set(accounts.map((a) => a.account.platform))];
  return platforms
    .flatMap((p) => (TREND_GUIDANCE[p] ? [`- ${TREND_GUIDANCE[p]}`] : []))
    .join('\n');
}

function countryName(code: string): string {
  return `${new Intl.DisplayNames('en', { type: 'region' }).of(code) ?? code} (${code})`;
}

export function calendarPrompt(input: CalendarPromptInput): string {
  return `Plan a content calendar.

Brief:
"""
${input.brief}
"""

Accounts:
${describeAccounts(input.accounts, true)}

Dates: ${input.firstDay} to ${input.lastDay}, in the audience's local time.
Audience time zone: ${input.timeZone}.
Audience country: ${input.country ? countryName(input.country) : 'not specified'}.
${input.trends ? `\nWhat's trending now:\n${input.trends}\n${trendGuidance(input.accounts)}\n` : ''}
Aim for about ${input.postsPerWeekPerAccount} posts per account per week, spread across the dates.
Never give one account more posts on one date than its posting limit; spread them over different dates instead.

Group the same idea for several platforms into one post with one target per account.
Each target's "text" is the finished, ready-to-publish post for that account.
Each target's "date" is the day it goes out, YYYY-MM-DD, within the dates above. Don't pick a time: Aby Socials picks the best hour for each platform.`;
}

export function variantsPrompt(
  idea: string,
  accounts: AccountContext[],
): string {
  return `Write one post about this idea for each account.

Idea:
"""
${idea}
"""

Accounts:
${describeAccounts(accounts)}

Return one variant per accountId, ready to publish.`;
}

export const CALENDAR_SCHEMA = {
  type: 'object',
  properties: {
    posts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short internal label' },
          idea: {
            type: 'string',
            description: 'The core idea in one or two sentences',
          },
          targets: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                accountId: { type: 'string' },
                text: { type: 'string' },
                date: {
                  type: 'string',
                  description: 'Audience-local day, YYYY-MM-DD',
                },
              },
              required: ['accountId', 'text', 'date'],
            },
          },
        },
        required: ['title', 'idea', 'targets'],
      },
    },
  },
  required: ['posts'],
} as const;

export const VARIANTS_SCHEMA = {
  type: 'object',
  properties: {
    variants: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          accountId: { type: 'string' },
          text: { type: 'string' },
        },
        required: ['accountId', 'text'],
      },
    },
  },
  required: ['variants'],
} as const;
