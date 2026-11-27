import type { Platform } from '../../../common/enums/platform.enum.js';

/** What a platform supports, so the agent and UI know what to expect. */
export interface ProviderCapabilities {
  /** Max length of a post's text, counted the way the platform counts it. */
  maxTextLength: number;
  /** How `maxTextLength` is counted: Unicode graphemes or UTF-16 characters. */
  lengthUnit: 'graphemes' | 'characters';
  /** Whether engagement numbers can be read back after publishing. */
  supportsMetrics: boolean;
  /** Short note on what a "post" is here, fed to the agent's prompt. */
  contentStyle: string;
  /** How accounts connect: pasted credentials, or the platform's OAuth sign-in. */
  connect: 'credentials' | 'oauth';
  /** Media the platform takes. Absent: text only, and attached media is not sent. */
  media?: MediaCapabilities;
}

export interface MediaCapabilities {
  /** True when a post can't go out without media (e.g. TikTok). */
  required: boolean;
  video: boolean;
  /** Most images in one post; 0 when images aren't supported. */
  maxImages: number;
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

/** Accounts that connect through the platform's OAuth sign-in. */
export interface OAuthConnector {
  isConfigured(): boolean;
  /** Where to send the user to approve access. */
  authorizeUrl(state: string): string;
  /** Exchanges the authorization code for credentials ready for `verify`. */
  exchange(code: string): Promise<object>;
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
