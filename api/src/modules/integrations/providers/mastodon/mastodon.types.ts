/** Response shapes of the Mastodon REST endpoints this provider calls. */

export interface MastodonAccount {
  id: string;
  username: string;
  /** `user` for local accounts, `user@domain` for remote ones. */
  acct: string;
  display_name: string;
  url: string;
  avatar: string;
}

export interface MastodonStatus {
  id: string;
  url: string | null;
  created_at: string;
  favourites_count: number;
  reblogs_count: number;
  replies_count: number;
  /** Mastodon 4.4+ only. */
  quotes_count?: number;
}
