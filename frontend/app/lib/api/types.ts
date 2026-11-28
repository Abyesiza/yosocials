/**
 * Response and request shapes of the Aby Socials API (mirrors the DTOs in
 * api/src/modules/*\/dto). Keep in sync when a DTO changes.
 */

export type Platform = "bluesky" | "mastodon" | "telegram" | "discord" | "tiktok" | "x" | "linkedin";
export type WorkspaceRole = "owner" | "admin" | "editor" | "viewer";
export type AccountPersona = "individual" | "influencer" | "company";
export type AccountStatus = "active" | "needs_reconnect";
export type TargetStatus = "draft" | "scheduled" | "publishing" | "processing" | "published" | "failed";
export type PostStatus =
  | "draft"
  | "scheduled"
  | "publishing"
  | "published"
  | "partially_published"
  | "failed";

export interface User {
  id: string;
  email: string;
  name: string;
  lastSignInAt: string | null;
  createdAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  role: WorkspaceRole;
  createdAt: string;
}

export interface Me {
  user: User;
  workspaces: Workspace[];
}

export interface Member {
  userId: string;
  email: string;
  name: string;
  role: WorkspaceRole;
  joinedAt: string;
}

export interface PlatformInfo {
  platform: Platform;
  displayName: string;
  maxTextLength: number;
  /** weighted: X’s count (links 23, CJK and emoji 2). */
  lengthUnit: "graphemes" | "characters" | "weighted";
  supportsMetrics: boolean;
  connect: "credentials" | "oauth";
  /** False while an OAuth platform's app credentials aren't configured. */
  available: boolean;
  /** null: text only; attached media isn't sent. */
  media: MediaCapabilities | null;
}

/** Width ÷ height. `preferred`: the shape the platform shows best (we frame to it); `min`/`max`: hard limits. */
export interface AspectSpec {
  min?: number;
  max?: number;
  preferred?: number;
}

export interface ImageSpec {
  types: string[];
  maxBytes: number;
  maxLongSide: number;
  maxShortSide: number;
  maxPixels?: number;
  /** Most width + height (Telegram). */
  maxSideSum?: number;
  aspect?: AspectSpec;
}

export interface VideoSpec {
  types: string[];
  maxBytes: number;
  minDurationSec?: number;
  maxDurationSec?: number;
  /** Video codecs that may go out unchanged (mediabunny names: avc, hevc). */
  codecs: string[];
  minShortSide?: number;
  maxLongSide: number;
  maxShortSide: number;
  maxPixels?: number;
  minFps?: number;
  maxFps?: number;
  aspect?: AspectSpec;
}

/** Mirrors the API's `MediaCapabilities`: the browser prepares a copy of each file that fits these. */
export interface MediaCapabilities {
  required: boolean;
  video: boolean;
  maxImages: number;
  imageSpec: ImageSpec | null;
  videoSpec: VideoSpec | null;
}

export type MediaContentType = "video/mp4" | "video/quicktime" | "video/webm" | "image/jpeg" | "image/webp";

/** The file a platform gets for this item: its own copy, or the original. Mirrors the API's `mediaFor`. */
export const mediaFor = (media: MediaItem, platform: Platform): MediaFile => media.variants.find((v) => v.platform === platform) ?? media;

/** One stored file: an original, or a copy prepared for one platform. */
export interface MediaFile {
  path: string;
  contentType: MediaContentType;
  size: number;
  width: number | null;
  height: number | null;
  url: string;
}

export interface MediaVariant extends MediaFile {
  platform: Platform;
}

/**
 * An attached photo or video. Platforms that can't take the original get
 * their own copy in `variants`. In a feed item the top-level file is already
 * the one that account's platform gets.
 */
export interface MediaItem extends MediaFile {
  kind: "image" | "video";
  durationSec: number | null;
  variants: MediaVariant[];
}

export type TikTokPrivacyLevel = "PUBLIC_TO_EVERYONE" | "MUTUAL_FOLLOW_FRIENDS" | "FOLLOWER_OF_CREATOR" | "SELF_ONLY";

export interface TikTokOptions {
  mode: "direct" | "inbox";
  privacyLevel?: TikTokPrivacyLevel;
  allowComment?: boolean;
  allowDuet?: boolean;
  allowStitch?: boolean;
  brandOrganic?: boolean;
  brandedContent?: boolean;
  isAigc?: boolean;
  photoTitle?: string;
  autoAddMusic?: boolean;
}

export interface TikTokCreatorInfo {
  nickname: string;
  username: string | null;
  avatarUrl: string | null;
  privacyLevelOptions: TikTokPrivacyLevel[];
  commentDisabled: boolean;
  duetDisabled: boolean;
  stitchDisabled: boolean;
  maxVideoPostDurationSec: number | null;
  canDirectPost: boolean;
  canUploadToInbox: boolean;
}

export interface Account {
  id: string;
  platform: Platform;
  handle: string;
  displayName: string;
  profileUrl: string | null;
  avatarUrl: string | null;
  persona: AccountPersona;
  voice: string | null;
  status: AccountStatus;
  lastError: string | null;
  createdAt: string;
}

export interface Metrics {
  likes: number | null;
  reposts: number | null;
  replies: number | null;
  quotes: number | null;
  views: number | null;
  updatedAt: string | null;
}

export interface PostTarget {
  id: string;
  account: Pick<Account, "id" | "platform" | "handle" | "displayName" | "avatarUrl">;
  text: string;
  customText: boolean;
  status: TargetStatus;
  options: Record<string, unknown> | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  externalUrl: string | null;
  lastError: string | null;
  metrics: Metrics;
}

export interface Post {
  id: string;
  title: string | null;
  body: string;
  media: MediaItem[];
  source: "manual" | "agent";
  status: PostStatus;
  targets: PostTarget[];
  createdAt: string;
  updatedAt: string;
}

export interface FeedItem extends PostTarget {
  postId: string;
  postTitle: string | null;
  media: MediaItem[];
}

export interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface PublishOutcome {
  targetId: string;
  status: TargetStatus;
  error?: string;
}

export interface EngagementTotals {
  posts: number;
  likes: number;
  reposts: number;
  replies: number;
  quotes: number;
  views: number;
  engagement: number;
}

export interface Overview {
  days: number;
  totals: EngagementTotals;
  accounts: (EngagementTotals & {
    accountId: string;
    platform: Platform;
    handle: string;
    displayName: string;
  })[];
  topPosts: {
    targetId: string;
    postId: string;
    platform: Platform;
    handle: string;
    text: string;
    externalUrl: string | null;
    publishedAt: string;
    engagement: number;
  }[];
}

export interface MetricPoint {
  capturedAt: string;
  likes: number | null;
  reposts: number | null;
  replies: number | null;
  quotes: number | null;
  views: number | null;
}

export interface PlanResult {
  model: string;
  posts: Post[];
  skipped: string[];
}

export interface VariantsResult {
  model: string;
  variants: { accountId: string; platform: Platform; text: string; fits: boolean }[];
}
