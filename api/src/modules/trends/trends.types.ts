/** Where a trend came from. Only free, legitimate sources (no X trends, no scraping). */
export type TrendSource = 'google_trends' | 'mastodon' | 'bluesky';

export interface TrendNews {
  title: string;
  url: string;
  source: string;
}

export interface TrendItem {
  source: TrendSource;
  /** Country-level (google_trends), or platform-wide (mastodon, bluesky). */
  scope: 'country' | 'global';
  term: string;
  /** e.g. Google Trends' “2,000+” searches; null when the source has none. */
  traffic: string | null;
  /** Where to read more about it. */
  url: string | null;
  news: TrendNews[];
  observedAt: string;
}

/** What's trending for one audience country, shared across workspaces and cached for a few hours. */
export interface TrendSnapshot {
  /** ISO 3166-1 alpha-2, e.g. "UG". */
  country: string;
  updatedAt: string;
  items: TrendItem[];
  /** Plain notes for people, e.g. that a source isn't available for this country. */
  notes: string[];
}
