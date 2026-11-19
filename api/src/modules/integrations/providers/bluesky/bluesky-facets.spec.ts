import { detectFacets } from './bluesky-facets.js';

const bytes = (s: string) => new TextEncoder().encode(s);
const slice = (text: string, start: number, end: number) =>
  new TextDecoder().decode(bytes(text).slice(start, end));

describe('detectFacets', () => {
  it('uses UTF-8 byte offsets, not string indexes', () => {
    const text = '🚀 Launch day! https://yosocials.app/launch #buildinpublic';
    const { facets } = detectFacets(text);

    const link = facets.find((f) => f.features[0].$type.endsWith('#link'))!;
    const tag = facets.find((f) => f.features[0].$type.endsWith('#tag'))!;

    expect(slice(text, link.index.byteStart, link.index.byteEnd)).toBe(
      'https://yosocials.app/launch',
    );
    expect(slice(text, tag.index.byteStart, tag.index.byteEnd)).toBe(
      '#buildinpublic',
    );
    expect(tag.features[0]).toEqual({
      $type: 'app.bsky.richtext.facet#tag',
      tag: 'buildinpublic',
    });
  });

  it('drops trailing punctuation from links and tags', () => {
    const text = 'Read https://example.com/a. Then #ship!';
    const { facets } = detectFacets(text);
    const values = facets.map((f) =>
      slice(text, f.index.byteStart, f.index.byteEnd),
    );
    expect(values).toEqual(['https://example.com/a', '#ship']);
  });

  it('returns mentions for the caller to resolve', () => {
    const text = 'Thanks @alice.bsky.social and @bob.example.com';
    const { mentions } = detectFacets(text);
    expect(mentions.map((m) => m.handle)).toEqual([
      'alice.bsky.social',
      'bob.example.com',
    ]);
    expect(
      slice(text, mentions[0].index.byteStart, mentions[0].index.byteEnd),
    ).toBe('@alice.bsky.social');
  });

  it('ignores emails and bare words', () => {
    const { facets, mentions } = detectFacets('mail me at hi@yo.app please');
    expect(facets).toEqual([]);
    expect(mentions).toEqual([]);
  });
});
