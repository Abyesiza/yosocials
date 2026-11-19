/** Response shapes of the AT Protocol endpoints this provider calls. */

export interface BlueskySession {
  did: string;
  handle: string;
  accessJwt: string;
  refreshJwt: string;
}

export interface BlueskyProfile {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
}

export interface BlueskyCreateRecordResponse {
  uri: string;
  cid: string;
}

export interface BlueskyPostView {
  uri: string;
  cid: string;
  likeCount?: number;
  repostCount?: number;
  replyCount?: number;
  quoteCount?: number;
  bookmarkCount?: number;
}

export interface BlueskyGetPostsResponse {
  posts: BlueskyPostView[];
}

export type BlueskyFacetFeature =
  | { $type: 'app.bsky.richtext.facet#link'; uri: string }
  | { $type: 'app.bsky.richtext.facet#tag'; tag: string }
  | { $type: 'app.bsky.richtext.facet#mention'; did: string };

/** Byte range (UTF-8, end exclusive) of a link, hashtag or mention. */
export interface BlueskyFacet {
  index: { byteStart: number; byteEnd: number };
  features: BlueskyFacetFeature[];
}
