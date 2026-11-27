/**
 * Response and request shapes of the Aby Socials API (mirrors the DTOs in
 * api/src/modules/*\/dto). Keep in sync when a DTO changes.
 */

export type Platform = "bluesky" | "mastodon" | "telegram" | "discord";
export type WorkspaceRole = "owner" | "admin" | "editor" | "viewer";
export type AccountPersona = "individual" | "influencer" | "company";
export type AccountStatus = "active" | "needs_reconnect";
export type TargetStatus = "draft" | "scheduled" | "publishing" | "published" | "failed";
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
  lengthUnit: "graphemes" | "characters";
  supportsMetrics: boolean;
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
  source: "manual" | "agent";
  status: PostStatus;
  targets: PostTarget[];
  createdAt: string;
  updatedAt: string;
}

export interface FeedItem extends PostTarget {
  postId: string;
  postTitle: string | null;
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
