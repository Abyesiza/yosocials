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
}

export interface PublishResult {
  /** The platform's id for the post, used later to fetch metrics. */
  externalId: string;
  externalUrl?: string;
  publishedAt: Date;
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

  /** Only called when `capabilities.supportsMetrics` is true. */
  fetchMetrics?(
    credentials: TCredentials,
    externalIds: string[],
  ): Promise<Map<string, PostMetrics>>;
}
