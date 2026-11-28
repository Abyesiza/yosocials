/** Shapes of the X API v2 responses this provider reads (api.x.com/2/openapi.json). */

export interface XTokenResponse {
  token_type: string;
  access_token: string;
  /** Seconds; two hours by default. */
  expires_in: number;
  /** Only with the offline.access scope. Rotates on every refresh. */
  refresh_token?: string;
  /** Space-separated. */
  scope: string;
}

/** An error in a 200 response, or the body of a 4xx/5xx. */
export interface XProblem {
  type?: string;
  title?: string;
  detail?: string;
  status?: number;
  /** Older error shape. */
  message?: string;
  code?: number;
}

export interface XEnvelope<T> {
  data?: T;
  errors?: XProblem[];
  includes?: { media?: XMedia[] };
}

export interface XErrorBody extends XProblem {
  errors?: XProblem[];
  error?: string;
  error_description?: string;
}

export interface XUser {
  id: string;
  name: string;
  username: string;
  profile_image_url?: string;
}

export interface XPost {
  id: string;
  text: string;
  public_metrics?: {
    repost_count: number;
    reply_count: number;
    like_count: number;
    quote_count: number;
    bookmark_count: number;
    impression_count: number;
  };
  /** Own posts from the last 30 days only. */
  non_public_metrics?: Record<string, number>;
  organic_metrics?: Record<string, number>;
  attachments?: { media_keys?: string[] };
}

export interface XMedia {
  media_key: string;
  type: string;
  public_metrics?: { view_count?: number };
}

export interface XUploadedMedia {
  id: string;
  media_key?: string;
  processing_info?: {
    state: 'pending' | 'in_progress' | 'succeeded' | 'failed';
    check_after_secs?: number;
    progress_percent?: number;
  };
}
