import type { Platform } from '../../../common/enums/platform.enum.js';
import type { LengthUnit } from '../../../common/text/text-length.js';

/** What a platform supports, so the agent and UI know what to expect. */
export interface ProviderCapabilities {
  /** Max length of a post's text, counted the way the platform counts it. */
  maxTextLength: number;
  /** How `maxTextLength` is counted (see `common/text/text-length.ts`). */
  lengthUnit: LengthUnit;
  /** Whether engagement numbers can be read back after publishing. */
  supportsMetrics: boolean;
  /** Least time between metrics reads; longer where each read is billed (X). Default 30. */
  metricsIntervalMinutes?: number;
  /** Short note on what a "post" is here, fed to the agent's prompt. */
  contentStyle: string;
  /** How accounts connect: pasted credentials, or the platform's OAuth sign-in. */
  connect: 'credentials' | 'oauth';
  /** Media the platform takes. Absent: text only, and attached media is not sent. */
  media?: MediaCapabilities;
  /** When and how often to post here: suggested times and the scheduling guard use it. */
  posting: PostingPolicy;
}

/**
 * A stretch of the week in the AUDIENCE's local time. `days` are 0 (Sunday)
 * to 6 (Saturday); `start`/`end` are "HH:MM", end exclusive, same day.
 */
export interface PostingWindow {
  days: number[];
  start: string;
  end: string;
  /** Higher is better (1 to 3). */
  weight: number;
}

/**
 * Research-backed defaults for one platform. Studies (Buffer, Sprout,
 * Hootsuite, Later 2025–2026) report audience-local times and aren't African,
 * so these are starting points, re-ranked by each account's own results.
 */
export interface PostingPolicy {
  /** Most posts a day per account we schedule, well inside the platform's limits. */
  maxPerDay: number;
  /** Least time between two posts from one account. */
  minSpacingMinutes: number;
  /** Best times first by weight. */
  windows: PostingWindow[];
  /** Times to stay away from. */
  avoid: PostingWindow[];
  /** Where the windows come from, shown with suggested times. */
  source: string;
  /** The platform's documented limits this policy stays inside, for people and logs. */
  limits: string[];
}

export interface MediaCapabilities {
  /** True when a post can't go out without media (e.g. TikTok). */
  required: boolean;
  video: boolean;
  /** Most images in one post; 0 when images aren't supported. */
  maxImages: number;
  /** What a photo must be. The web app makes a copy that fits; publishing checks it. */
  imageSpec: ImageSpec | null;
  /** What a video must be. Absent when `video` is false. */
  videoSpec: VideoSpec | null;
}

/**
 * Width ÷ height. `preferred` is the shape the platform shows best (TikTok's
 * 9:16): the web app frames media to it, as the person chooses. `min`/`max`
 * are hard limits.
 */
export interface AspectSpec {
  min?: number;
  max?: number;
  preferred?: number;
}

export interface ImageSpec {
  types: string[];
  maxBytes: number;
  /** Longest side, either orientation. */
  maxLongSide: number;
  /** Shortest side, either orientation. */
  maxShortSide: number;
  /** Most width × height, where the platform limits it separately. */
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
  /** Video codecs the browser may hand over unchanged (mediabunny names: avc, hevc). */
  codecs: string[];
  /** Shortest side must be at least this. */
  minShortSide?: number;
  maxLongSide: number;
  maxShortSide: number;
  /** Most width × height (Mastodon's matrix limit). */
  maxPixels?: number;
  minFps?: number;
  maxFps?: number;
  aspect?: AspectSpec;
}

export type MediaKind = 'image' | 'video';

/** An uploaded file, as the provider receives it. */
export interface PublishMedia {
  kind: MediaKind;
  /** Public https URL the platform can fetch without redirects. */
  url: string;
  contentType: string;
  size: number;
  durationSec?: number | null;
  /** Unknown (null) for media attached before dimensions were recorded. */
  width?: number | null;
  height?: number | null;
}

/** Public, non-secret details of the account the credentials belong to. */
export interface VerifiedAccount {
  externalId: string;
  handle: string;
  displayName: string;
  profileUrl?: string;
  avatarUrl?: string;
}

export interface PublishInput {
  text: string;
  /** Stable per-target key so a retried publish doesn't post twice. */
  idempotencyKey: string;
  media: PublishMedia[];
  /** Platform-specific settings for this target, validated by `parseTargetOptions`. */
  options: Record<string, unknown> | null;
}

/** What `readinessIssues` checks before a target may be scheduled or published. */
export type ReadinessInput = Omit<PublishInput, 'idempotencyKey'>;

export interface PublishResult {
  /** The platform's id for the post, used later to fetch metrics. */
  externalId: string;
  externalUrl?: string;
  publishedAt: Date;
  /**
   * The platform accepted the post but finishes it asynchronously; `externalId`
   * is then its job id, and `checkPublish` reports the outcome.
   */
  processing?: boolean;
}

/** Outcome of an asynchronous publish, from `checkPublish`. */
export type PublishCheck =
  | { state: 'processing' }
  /** Delivered as a draft the creator finishes in the platform's app. */
  | { state: 'in_inbox' }
  | { state: 'published'; externalId?: string; externalUrl?: string }
  | { state: 'failed'; reason: string };

/**
 * Accounts that connect through the platform's OAuth sign-in. `codeVerifier`
 * is a PKCE verifier derived from the signed state, the same on both calls;
 * platforms without PKCE ignore it.
 */
export interface OAuthConnector {
  isConfigured(): boolean;
  /** Where to send the user to approve access. */
  authorizeUrl(state: string, codeVerifier: string): string;
  /** Exchanges the authorization code for credentials ready for `verify`. */
  exchange(code: string, codeVerifier: string): Promise<object>;
}

/**
 * Engagement numbers, normalised across platforms. A field is `undefined`
 * when the platform doesn't expose it (never `0` as a stand-in).
 */
export interface PostMetrics {
  likes?: number;
  reposts?: number;
  replies?: number;
  quotes?: number;
  views?: number;
  /** The platform's raw counters, kept for debugging and future fields. */
  raw: Record<string, unknown>;
}

/**
 * One implementation per platform. Providers are stateless: credentials are
 * decrypted by the caller and passed in on every call.
 *
 * `TCredentials` is the decrypted, validated credentials shape for this
 * platform (see each provider's `*-credentials.dto.ts`).
 */
export interface PlatformProvider<TCredentials extends object = object> {
  readonly platform: Platform;
  readonly displayName: string;
  readonly capabilities: ProviderCapabilities;

  readonly oauth?: OAuthConnector;

  /** Validates untrusted input into typed credentials, or throws 400. */
  parseCredentials(raw: unknown): Promise<TCredentials>;

  /** Calls the platform to prove the credentials work. */
  verify(credentials: TCredentials): Promise<VerifiedAccount>;

  publish(
    credentials: TCredentials,
    input: PublishInput,
  ): Promise<PublishResult>;

  /** Ends any platform session held for these credentials (account disconnected). */
  disconnect?(credentials: TCredentials): Promise<void>;

  /** Validates a target's platform settings, or throws 400. Absent: no settings. */
  parseTargetOptions?(raw: unknown): Promise<Record<string, unknown>>;

  /** Problems that stop this content going out (missing media, settings). Empty when ready. */
  readinessIssues?(input: ReadinessInput): string[];

  /** Reports on a publish that returned `processing: true`. */
  checkPublish?(
    credentials: TCredentials,
    externalId: string,
  ): Promise<PublishCheck>;

  /** Live details the composer must show before posting (e.g. TikTok's creator info). */
  creatorInfo?(credentials: TCredentials): Promise<object>;

  /** Only called when `capabilities.supportsMetrics` is true. */
  fetchMetrics?(
    credentials: TCredentials,
    externalIds: string[],
  ): Promise<Map<string, PostMetrics>>;
}
