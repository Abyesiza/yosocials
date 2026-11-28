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

/** POST /api/v2/media, GET /api/v1/media/:id. `url` is null while the server is still processing. */
export interface MastodonMediaAttachment {
  id: string;
  type: string;
  url: string | null;
}

/** GET /api/v2/instance: the parts that limit media. */
export interface MastodonInstance {
  configuration?: {
    statuses?: { max_media_attachments?: number };
    media_attachments?: {
      image_size_limit?: number;
      image_matrix_limit?: number;
      video_size_limit?: number;
      video_matrix_limit?: number;
    };
  };
}
