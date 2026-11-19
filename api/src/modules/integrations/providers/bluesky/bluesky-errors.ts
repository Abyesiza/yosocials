import { PlatformApiError } from '../../../../common/http/http-client.js';

// @atproto/lex and lex-password-session ship separate XrpcError classes, so match by shape.
interface XrpcLike {
  name: string;
  message: string;
  error: string;
  status?: number;
  shouldRetry: () => boolean;
}

function asXrpc(error: unknown): XrpcLike | null {
  if (!(error instanceof Error)) return null;
  const e = error as Partial<XrpcLike>;
  return typeof e.error === 'string' && typeof e.shouldRetry === 'function'
    ? (e as XrpcLike)
    : null;
}

// A refresh with a revoked or expired token answers 400 with one of these codes.
const AUTH_CODES = new Set([
  'AuthenticationRequired',
  'ExpiredToken',
  'InvalidToken',
  'AuthMissing',
]);

/** Maps the SDK's XRPC errors onto our retry/reconnect semantics. */
export function toPlatformError(error: unknown): unknown {
  if (error instanceof PlatformApiError) return error;
  const x = asXrpc(error);
  if (!x) return error;
  if (
    x.name === 'XrpcAuthenticationError' ||
    AUTH_CODES.has(x.error) ||
    x.status === 401
  ) {
    return new PlatformApiError(
      x.message || 'Bluesky rejected the session',
      401,
      false,
      x.error,
    );
  }
  return new PlatformApiError(
    x.message || `Bluesky error ${x.error}`,
    x.status ?? 0,
    x.shouldRetry(),
    x.error,
  );
}

export function isAuthFailure(error: unknown): boolean {
  const mapped = toPlatformError(error);
  return (
    mapped instanceof PlatformApiError &&
    (mapped.status === 401 || mapped.status === 403)
  );
}
