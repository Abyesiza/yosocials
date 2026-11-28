import { decodeEntities, plainText, safeUrl } from './plain-text.js';
import type { TrendItem, TrendNews } from './trends.types.js';

const MAX_ITEMS = 20;
const MAX_NEWS_PER_ITEM = 3;

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Every `<name>…</name>` body in `xml`, in order. The feed never nests an element in itself. */
function elements(xml: string, name: string): string[] {
  const tag = escapeRegExp(name);
  const pattern = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'g');
  return [...xml.matchAll(pattern)].map((m) => m[1]);
}

/** An element's text: CDATA taken literally, everything else entity-decoded, then flattened to plain text. */
function text(xml: string, name: string, maxLength?: number): string {
  const body = elements(xml, name)[0];
  if (body === undefined) return '';
  const decoded = body
    .split(/(<!\[CDATA\[[\s\S]*?\]\]>)/)
    .map((part) =>
      part.startsWith('<![CDATA[')
        ? part.slice(9, -3)
        : decodeEntities(part.replace(/<[^>]*>/g, '')),
    )
    .join('');
  return plainText(decoded, maxLength);
}

/** "2000+" → "2,000+", leaving anything unexpected as it came. */
function formatTraffic(raw: string): string | null {
  if (!raw) return null;
  const match = /^(\d+)(\+?)$/.exec(raw.replace(/,/g, ''));
  return match
    ? `${Number(match[1]).toLocaleString('en-GB')}${match[2]}`
    : raw.slice(0, 40);
}

function news(item: string): TrendNews[] {
  return elements(item, 'ht:news_item')
    .map((entry) => ({
      title: text(entry, 'ht:news_item_title'),
      url: safeUrl(text(entry, 'ht:news_item_url', 2000)),
      source: text(entry, 'ht:news_item_source', 100),
    }))
    .filter((n): n is TrendNews => Boolean(n.title && n.url))
    .slice(0, MAX_NEWS_PER_ITEM);
}

/**
 * Parses Google Trends' “Trending now” RSS (`trends.google.com/trending/rss?geo=XX`).
 * The feed is unofficial and its shape fixed, so a small parser does instead of an XML library.
 */
export function parseGoogleTrendsRss(
  xml: string,
  fetchedAt: Date,
): TrendItem[] {
  return elements(xml, 'item')
    .slice(0, MAX_ITEMS)
    .map((item): TrendItem | null => {
      const term = text(item, 'title', 150);
      if (!term) return null;
      const published = Date.parse(text(item, 'pubDate'));
      const related = news(item);
      return {
        source: 'google_trends',
        scope: 'country',
        term,
        traffic: formatTraffic(text(item, 'ht:approx_traffic')),
        url: related[0]?.url ?? null,
        news: related,
        observedAt: new Date(
          Number.isNaN(published) ? fetchedAt.getTime() : published,
        ).toISOString(),
      };
    })
    .filter((item): item is TrendItem => item !== null);
}
