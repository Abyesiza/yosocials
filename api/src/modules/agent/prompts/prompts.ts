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

function describeAccounts(accounts: AccountContext[]): string {
  return accounts
    .map(({ account, platformName, capabilities }) =>
      [
        `- accountId: ${account.id}`,
        `  platform: ${platformName} (${account.handle})`,
        `  persona: ${account.persona}`,
        `  voice: ${account.voice ?? 'not specified'}`,
        `  max length: ${capabilities.maxTextLength} ${capabilities.lengthUnit}`,
        `  style: ${capabilities.contentStyle}`,
      ].join('\n'),
    )
    .join('\n');
}

export function calendarPrompt(input: {
  brief: string;
  accounts: AccountContext[];
  start: Date;
  end: Date;
  timezone: string;
  postsPerWeekPerAccount: number;
}): string {
  return `Plan a content calendar.

Brief:
"""
${input.brief}
"""

Accounts:
${describeAccounts(input.accounts)}

Window: ${input.start.toISOString()} to ${input.end.toISOString()}.
Audience timezone: ${input.timezone}. Pick posting times when that audience is active.
Aim for about ${input.postsPerWeekPerAccount} posts per account per week, spread across the window.

Group the same idea for several platforms into one post with one target per account.
Each target's "text" is the finished, ready-to-publish post for that account.
"scheduledAt" must be ISO 8601 with a UTC offset and inside the window.`;
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
                scheduledAt: { type: 'string', format: 'date-time' },
              },
              required: ['accountId', 'text', 'scheduledAt'],
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
