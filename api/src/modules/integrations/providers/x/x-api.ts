import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PlatformApiError,
  requestJson,
  type RequestOptions,
} from '../../../../common/http/http-client.js';
import { Platform } from '../../../../common/enums/platform.enum.js';
import type { EnvironmentVariables } from '../../../../config/env.validation.js';
import type { ProviderSessionStore } from '../../interfaces/provider-session-store.interface.js';
import { ProviderSessionsService } from '../../sessions/provider-sessions.service.js';
import type {
  XEnvelope,
  XErrorBody,
  XProblem,
  XTokenResponse,
  XUser,
} from './x.types.js';

export const X_API = 'https://api.x.com';
const AUTHORIZE_URL = 'https://x.com/i/oauth2/authorize';
/** Refresh this long before the two-hour access token runs out. */
const REFRESH_MARGIN_MS = 5 * 60_000;

/** OAuth tokens for one X user, kept encrypted in the session store. */
interface XTokens {
  accessToken: string;
  refreshToken: string | null;
  scope: string;
  expiresAt: number;
}

const RECONNECT =
  'X access has expired or was removed. Reconnect the X account.';

type CallInit = Pick<
  RequestOptions,
  'method' | 'json' | 'query' | 'multipart' | 'timeoutMs'
>;

/**
 * X API v2 client: OAuth 2.0 with PKCE, per-user tokens that refresh
 * themselves (under a lock, as X rotates refresh tokens), and X's error
 * shapes turned into PlatformApiErrors.
 */
@Injectable()
export class XApi {
  private readonly clientId?: string;
  private readonly clientSecret?: string;
  private readonly redirectUri?: string;
  private readonly scopes: string;

  constructor(
    config: ConfigService<EnvironmentVariables, true>,
    private readonly sessions: ProviderSessionsService,
  ) {
    this.clientId = config.get('X_CLIENT_ID', { infer: true });
    this.clientSecret = config.get('X_CLIENT_SECRET', { infer: true });
    this.redirectUri = config.get('X_REDIRECT_URI', { infer: true });
    this.scopes = config.get('X_SCOPES', { infer: true });
  }

  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret && this.redirectUri);
  }

  authorizeUrl(state: string, codeVerifier: string): string {
    const { clientId, redirectUri } = this.app();
    const url = new URL(AUTHORIZE_URL);
    url.search = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: this.scopes,
      state,
      code_challenge: createHash('sha256')
        .update(codeVerifier)
        .digest('base64url'),
      code_challenge_method: 'S256',
    }).toString();
    return url.toString();
  }

  /** Trades the authorization code for tokens and stores them. Returns the user's X id. */
  async exchangeCode(code: string, codeVerifier: string): Promise<string> {
    const res = await this.tokenCall({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.app().redirectUri,
      code_verifier: codeVerifier,
    });
    // The token response doesn't say whose it is.
    const { data } = await this.send<XEnvelope<XUser>>(
      res.access_token,
      '/2/users/me',
      {},
    );
    if (!data)
      throw new PlatformApiError('X didn’t return the account', 502, true);
    await this.store(data.id, res);
    return data.id;
  }

  /** Calls the API as this user; throws when the response carries only errors. */
  async call<T>(
    userId: string,
    path: string,
    init: CallInit = {},
  ): Promise<XEnvelope<T>> {
    const { accessToken } = await this.tokens(userId);
    return this.send<XEnvelope<T>>(accessToken, path, init);
  }

  /** Revokes the user's tokens on X and forgets them. Best effort. */
  async revoke(userId: string): Promise<void> {
    const tokens = await this.sessions.load<XTokens>(this.key(userId));
    await this.sessions.remove(this.key(userId));
    if (!tokens || !this.isConfigured()) return;
    for (const token of [tokens.refreshToken, tokens.accessToken]) {
      if (!token) continue;
      await requestJson(`${X_API}/2/oauth2/revoke`, {
        headers: this.basicAuth(),
        form: { token },
      }).catch(() => undefined);
    }
  }

  private async send<T extends XEnvelope<unknown>>(
    accessToken: string,
    path: string,
    init: CallInit,
  ): Promise<T> {
    let body: T;
    try {
      body = await requestJson<T>(`${X_API}${path}`, {
        ...init,
        headers: { authorization: `Bearer ${accessToken}` },
        timeoutMs: init.timeoutMs ?? 30_000,
      });
    } catch (error) {
      throw this.rewrite(error);
    }
    if (body?.data === undefined && body?.errors?.length) {
      throw this.toError(body.errors[0], 400);
    }
    return body;
  }

  private async tokens(userId: string): Promise<XTokens> {
    const key = this.key(userId);
    const tokens = await this.sessions.load<XTokens>(key);
    if (!tokens) throw new PlatformApiError(RECONNECT, 401, false);
    if (this.fresh(tokens)) return tokens;

    return this.sessions.withLock(key, async (locked) => {
      // Another process may have refreshed while we waited for the lock.
      const current = await locked.load<XTokens>(key);
      if (!current?.refreshToken) {
        throw new PlatformApiError(RECONNECT, 401, false);
      }
      if (this.fresh(current)) return current;
      const res = await this.tokenCall({
        grant_type: 'refresh_token',
        refresh_token: current.refreshToken,
      }).catch((error: unknown) => {
        if (error instanceof PlatformApiError && !error.retryable) {
          throw new PlatformApiError(RECONNECT, 401, false);
        }
        throw error;
      });
      return this.store(userId, res, current.refreshToken, locked);
    });
  }

  private fresh(tokens: XTokens): boolean {
    return tokens.expiresAt - REFRESH_MARGIN_MS > Date.now();
  }

  private async tokenCall(
    form: Record<string, string>,
  ): Promise<XTokenResponse> {
    const res = await requestJson<XTokenResponse>(`${X_API}/2/oauth2/token`, {
      headers: this.basicAuth(),
      form,
    });
    if (!res?.access_token) {
      throw new PlatformApiError('X rejected the sign-in', 400, false);
    }
    return res;
  }

  private async store(
    userId: string,
    res: XTokenResponse,
    previousRefreshToken: string | null = null,
    sessions: ProviderSessionStore = this.sessions,
  ): Promise<XTokens> {
    const tokens: XTokens = {
      accessToken: res.access_token,
      refreshToken: res.refresh_token ?? previousRefreshToken,
      scope: res.scope,
      expiresAt: Date.now() + res.expires_in * 1000,
    };
    await sessions.save(this.key(userId), Platform.X, tokens);
    return tokens;
  }

  private rewrite(error: unknown): unknown {
    if (!(error instanceof PlatformApiError) || error.status === 0)
      return error;
    const body = (error.body ?? {}) as XErrorBody;
    return this.toError(body.errors?.[0] ?? body, error.status);
  }

  /** What X's errors mean for the person posting. */
  private toError(problem: XProblem, status: number): PlatformApiError {
    const detail = problem.detail ?? problem.message ?? problem.title ?? '';
    const type = problem.type ?? '';
    if (status === 401)
      return new PlatformApiError(RECONNECT, 401, false, problem);
    if (status === 402 || /credit/i.test(type)) {
      return new PlatformApiError(
        'Aby Socials’ X API credits have run out. Ask whoever runs Aby Socials to top them up.',
        402,
        false,
        problem,
      );
    }
    if (status === 429 || type.endsWith('/usage-capped')) {
      return new PlatformApiError(
        'X is limiting how often Aby Socials can post or read right now. Trying again shortly.',
        429,
        true,
        problem,
      );
    }
    // X answers 403, but the account is fine: 409 keeps it from being flagged for reconnecting.
    if (/duplicate/i.test(detail)) {
      return new PlatformApiError(
        'X rejected this as a duplicate of a recent post from this account. Change the text and try again.',
        409,
        false,
        problem,
      );
    }
    return new PlatformApiError(
      detail ? `X: ${detail}` : `X responded ${status}`,
      status,
      status >= 500,
      problem,
    );
  }

  private basicAuth(): Record<string, string> {
    const { clientId, clientSecret } = this.app();
    const encoded = Buffer.from(`${clientId}:${clientSecret}`).toString(
      'base64',
    );
    return { authorization: `Basic ${encoded}` };
  }

  private key(userId: string): string {
    return `x:${userId}`;
  }

  private app() {
    if (!this.clientId || !this.clientSecret || !this.redirectUri) {
      throw new PlatformApiError(
        'X isn’t set up yet (X_CLIENT_ID, X_CLIENT_SECRET and X_REDIRECT_URI)',
        503,
        false,
      );
    }
    return {
      clientId: this.clientId,
      clientSecret: this.clientSecret,
      redirectUri: this.redirectUri,
    };
  }
}
