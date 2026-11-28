import { requestJson } from '../../common/http/http-client.js';
import { parseGoogleTrendsRss } from './google-trends-rss.js';
import { plainText, safeUrl } from './plain-text.js';
import type { TrendItem } from './trends.types.js';

export const SOURCE_TIMEOUT_MS = 5_000;
const LIMIT = 10;
const MAX_FEED_BYTES = 1_000_000;

/** Google Trends has no daily list for this country (it answers 400). */
export class CountryNotCovered extends Error {}

export async function fetchGoogleTrends(
  country: string,
  now: Date,
): Promise<TrendItem[]> {
  const url = new URL('https://trends.google.com/trending/rss');
  url.searchParams.set('geo', country);
  const response = await fetch(url, {
    headers: { accept: 'application/rss+xml, application/xml, text/xml' },
    signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS),
  });
  if (response.status === 400 || response.status === 404) {
    throw new CountryNotCovered(`HTTP ${response.status}`);
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const xml = await response.text();
  if (xml.length > MAX_FEED_BYTES) throw new Error('feed too large');
  const items = parseGoogleTrendsRss(xml, now);
  // An empty list from a 200 most likely means the unofficial feed changed shape.
  if (items.length === 0) throw new Error('no items in feed');
  return items;
}

interface MastodonTag {
  name?: unknown;
  url?: unknown;
  history?: { uses?: unknown }[];
}

export async function fetchMastodonTags(now: Date): Promise<TrendItem[]> {
  const tags = await requestJson<unknown>(
    'https://mastodon.social/api/v1/trends/tags',
    { query: { limit: String(LIMIT) }, timeoutMs: SOURCE_TIMEOUT_MS },
  );
  if (!Array.isArray(tags)) throw new Error('unexpected response');
  return (tags as MastodonTag[])
    .filter((tag) => typeof tag?.name === 'string' && tag.name)
    .slice(0, LIMIT)
    .map((tag): TrendItem => {
      // History is newest day first.
      const uses = Number(tag.history?.[0]?.uses);
      return {
        source: 'mastodon',
        scope: 'global',
        term: `#${plainText(tag.name as string, 100)}`,
        traffic: Number.isFinite(uses) ? uses.toLocaleString('en-GB') : null,
        url: typeof tag.url === 'string' ? safeUrl(tag.url) : null,
        news: [],
        observedAt: now.toISOString(),
      };
    });
}

interface BlueskyTopic {
  topic?: unknown;
  displayName?: unknown;
  link?: unknown;
}

export async function fetchBlueskyTopics(now: Date): Promise<TrendItem[]> {
  const body = await requestJson<{ topics?: unknown }>(
    'https://public.api.bsky.app/xrpc/app.bsky.unspecced.getTrendingTopics',
    { query: { limit: String(LIMIT) }, timeoutMs: SOURCE_TIMEOUT_MS },
  );
  if (!Array.isArray(body?.topics)) throw new Error('unexpected response');
  return (body.topics as BlueskyTopic[])
    .map((topic) => ({
      term: plainText(
        [topic?.displayName, topic?.topic].find(
          (v): v is string => typeof v === 'string',
        ) ?? '',
        150,
      ),
      link: typeof topic?.link === 'string' ? topic.link : undefined,
    }))
    .filter((topic) => topic.term)
    .slice(0, LIMIT)
    .map(({ term, link }): TrendItem => ({
      source: 'bluesky',
      scope: 'global',
      term,
      traffic: null,
      url: safeUrl(link, 'https://bsky.app'),
      news: [],
      observedAt: now.toISOString(),
    }));
}
