import { GOOGLE_TRENDS_UG_RSS } from '../../../test/support/trends-fixtures.js';
import { parseGoogleTrendsRss } from './google-trends-rss.js';
import { decodeEntities, plainText, safeUrl } from './plain-text.js';

const fetchedAt = new Date('2026-11-28T09:00:00Z');

const feed = (item: string) =>
  `<rss xmlns:ht="https://trends.google.com/trending/rss"><channel><title>Daily Search Trends</title><item>${item}</item></channel></rss>`;

describe('parseGoogleTrendsRss', () => {
  it('parses the live feed’s items, traffic, dates and news', () => {
    const items = parseGoogleTrendsRss(GOOGLE_TRENDS_UG_RSS, fetchedAt);

    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      source: 'google_trends',
      scope: 'country',
      term: 'mauricio pochettino',
      traffic: '500+',
      url: 'https://www.espn.co.uk/football/story/_/id/50612072/pochettino-defends-management-style-man-united',
      news: [
        {
          title:
            "Pochettino defends his Man United management style: 'I'm not nice'",
          url: 'https://www.espn.co.uk/football/story/_/id/50612072/pochettino-defends-management-style-man-united',
          source: 'ESPN',
        },
        expect.objectContaining({ source: 'Sky Sports' }),
        expect.objectContaining({ source: 'NewVision.co.ug' }),
      ],
      observedAt: '2026-11-28T08:20:00.000Z',
    });
    expect(items[1].traffic).toBe('2,000+');
    expect(items[1].news[0].url).toContain(
      '?utm_medium=rcom-article-media&utm_campaign=rcom-rcp-lead',
    );
  });

  it('takes CDATA literally and strips markup from it', () => {
    const [item] = parseGoogleTrendsRss(
      feed(
        '<title><![CDATA[Tom & Jerry <b>live</b> &amp; more]]></title><ht:approx_traffic>abc</ht:approx_traffic><pubDate>not a date</pubDate>',
      ),
      fetchedAt,
    );
    expect(item.term).toBe('Tom & Jerry live &amp; more');
    expect(item.traffic).toBe('abc');
    expect(item.observedAt).toBe(fetchedAt.toISOString());
  });

  it('never lets feed content become markup or unsafe links', () => {
    const [item] = parseGoogleTrendsRss(
      feed(`<title>&lt;script&gt;alert(1)&lt;/script&gt;hello</title>
        <ht:news_item><ht:news_item_title>Bad link</ht:news_item_title><ht:news_item_url>javascript:alert(1)</ht:news_item_url></ht:news_item>
        <ht:news_item><ht:news_item_title>Good</ht:news_item_title><ht:news_item_url>https://example.com/a</ht:news_item_url><ht:news_item_source>Ex</ht:news_item_source></ht:news_item>`),
      fetchedAt,
    );
    expect(item.term).toBe('alert(1)hello');
    expect(item.news).toEqual([
      { title: 'Good', url: 'https://example.com/a', source: 'Ex' },
    ]);
  });

  it('skips items without a title and returns nothing for other XML', () => {
    expect(parseGoogleTrendsRss(feed('<title> </title>'), fetchedAt)).toEqual(
      [],
    );
    expect(parseGoogleTrendsRss('<html>Error</html>', fetchedAt)).toEqual([]);
  });
});

describe('plain text helpers', () => {
  it('decodes named and numeric entities once', () => {
    expect(
      decodeEntities('&amp;lt; &quot;a&quot; &#8217; &#x1F600; &bogus;'),
    ).toBe('&lt; "a" ’ 😀 &bogus;');
    expect(decodeEntities('&#xD800;&#0;x')).toBe('x');
  });

  it('flattens to one line without control or bidi characters', () => {
    expect(plainText('a\n\tb\u202Ec  <i>d</i>', 100)).toBe('a b c d');
    expect(plainText('x'.repeat(10), 4)).toBe('xxxx');
  });

  it('accepts only http(s) URLs', () => {
    expect(safeUrl('/profile/x', 'https://bsky.app')).toBe(
      'https://bsky.app/profile/x',
    );
    expect(safeUrl('data:text/html,hi')).toBeNull();
    expect(safeUrl('not a url')).toBeNull();
  });
});
