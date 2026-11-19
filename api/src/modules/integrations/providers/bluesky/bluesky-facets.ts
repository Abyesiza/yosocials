import type { BlueskyFacet } from './bluesky.types.js';

/**
 * Bluesky posts are plain text; links, hashtags and mentions only become
 * clickable when described as "facets" with UTF-8 byte offsets. This finds
 * them in the text. Mentions need the handle resolved to a DID, so they are
 * returned separately for the caller to resolve.
 */

const URL_RE = /https?:\/\/[^\s<>"')\]]+[^\s<>"')\].,;:!?]/g;
const TAG_RE = /(^|\s)#([^\s#\p{P}][^\s#]*)/gu;
const MENTION_RE =
  /(^|\s)@(([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]([a-z0-9-]{0,61}[a-z0-9])?)/gi;

const encoder = new TextEncoder();
const byteLength = (s: string): number => encoder.encode(s).length;

function byteRange(text: string, start: number, end: number) {
  const byteStart = byteLength(text.slice(0, start));
  return { byteStart, byteEnd: byteStart + byteLength(text.slice(start, end)) };
}

export interface PendingMention {
  handle: string;
  index: { byteStart: number; byteEnd: number };
}

export function detectFacets(text: string): {
  facets: BlueskyFacet[];
  mentions: PendingMention[];
} {
  const facets: BlueskyFacet[] = [];

  for (const m of text.matchAll(URL_RE)) {
    facets.push({
      index: byteRange(text, m.index, m.index + m[0].length),
      features: [{ $type: 'app.bsky.richtext.facet#link', uri: m[0] }],
    });
  }

  for (const m of text.matchAll(TAG_RE)) {
    const tag = m[2].replace(/\p{P}+$/u, '');
    if (!tag || tag.length > 64) continue;
    const start = m.index + m[1].length;
    facets.push({
      index: byteRange(text, start, start + 1 + tag.length),
      features: [{ $type: 'app.bsky.richtext.facet#tag', tag }],
    });
  }

  const mentions: PendingMention[] = [];
  for (const m of text.matchAll(MENTION_RE)) {
    const start = m.index + m[1].length;
    mentions.push({
      handle: m[2],
      index: byteRange(text, start, start + 1 + m[2].length),
    });
  }

  return { facets, mentions };
}
