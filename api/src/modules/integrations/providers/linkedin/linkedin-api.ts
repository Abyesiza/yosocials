import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PlatformApiError,
  requestJson,
  requestWithHeaders,
  type RequestOptions,
} from '../../../../common/http/http-client.js';
import { Platform } from '../../../../common/enums/platform.enum.js';
import type { EnvironmentVariables } from '../../../../config/env.validation.js';
import type { ProviderSessionStore } from '../../interfaces/provider-session-store.interface.js';
import { ProviderSessionsService } from '../../sessions/provider-sessions.service.js';
import type {
  LinkedInErrorBody,
  LinkedInTokenResponse,
  LinkedInUserInfo,
} from './linkedin.types.js';

export const LINKEDIN_API = 'https://api.linkedin.com';
const OAUTH = 'https://www.linkedin.com/oauth/v2';
/** Refresh (where LinkedIn allows it) this long before the 60-day token runs out. */
const REFRESH_MARGIN_MS = 24 * 3_600_000;

/** OAuth tokens for one LinkedIn member, kept encrypted in the session store. */
interface LinkedInTokens {
  accessToken: string;
  expiresAt: number;
  refreshToken: string | null;
  refreshExpiresAt: number | null;
  scope: string;
}

const RECONNECT =
  'Your LinkedIn connection has expired or was removed. Reconnect the account to keep posting.';

type CallInit = Pick<
  RequestOptions,
  'method' | 'json' | 'headers' | 'timeoutMs'
>;

/**
 * LinkedIn API client: the OAuth handshake, per-member tokens (60 days,
 * refreshed only for apps LinkedIn has approved for refresh tokens), and
 * versioned REST calls with LinkedIn's errors turned into PlatformApiErrors.
 */
@Injectable()
export class LinkedInApi {
  private readonly clientId?: string;
  private readonly clientSecret?: string;
  private readonly redirectUri?: string;
  private readonly scopes: string;
  private readonly version: string;

  constructor(
    config: ConfigService<EnvironmentVariables, true>,
    private readonly sessions: ProviderSessionsService,
  ) {
    this.clientId = config.get('LINKEDIN_CLIENT_ID', { infer: true });
    this.clientSecret = config.get('LINKEDIN_CLIENT_SECRET', { infer: true });
    this.redirectUri = config.get('LINKEDIN_REDIRECT_URI', { infer: true });
    this.scopes = config.get('LINKEDIN_SCOPES', { infer: true });
    this.version = config.get('LINKEDIN_API_VERSION', { infer: true });
  }

  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret && this.redirectUri);
  }

  authorizeUrl(state: string): string {
    const { clientId, redirectUri } = this.app();
    const url = new URL(`${OAUTH}/authorization`);
    url.search = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      scope: this.scopes,
    }).toString();
    return url.toString();
  }

  /** Trades the authorization code for tokens and stores them. Returns the member id. */
  async exchangeCode(code: string): Promise<string> {
    const { redirectUri } = this.app();
    const res = await this.tokenCall({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    });
    // The token response doesn't say whose it is.
    const user = await this.userInfo(res.access_token);
    await this.store(user.sub, res);
    return user.sub;
  }

  async grantedScopes(memberId: string): Promise<Set<string>> {
    return new Set((await this.tokens(memberId)).scope.split(/[\s,]+/));
  }

  async userInfo(accessToken: string): Promise<LinkedInUserInfo> {
    return this.send<LinkedInUserInfo>(
      accessToken,
      '/v2/userinfo',
      {},
      false,
    ).then((r) => r.body);
  }

  /** The member's access token, for calls to signed upload URLs. */
  async accessToken(memberId: string): Promise<string> {
    return (await this.tokens(memberId)).accessToken;
  }

  /** Calls a versioned `/rest` endpoint as this member. `path` may carry a Rest.li query, already encoded. */
  async call<T>(
    memberId: string,
    path: string,
    init: CallInit = {},
  ): Promise<{ body: T; headers: Headers }> {
    const { accessToken } = await this.tokens(memberId);
    return this.send<T>(accessToken, path, init, true);
  }

  /** Forgets the member's tokens. LinkedIn has no revoke endpoint for this flow. */
  async forget(memberId: string): Promise<void> {
    await this.sessions.remove(this.key(memberId));
  }

  private async send<T>(
    accessToken: string,
    path: string,
    init: CallInit,
    versioned: boolean,
  ): Promise<{ body: T; headers: Headers }> {
    try {
      return await requestWithHeaders<T>(`${LINKEDIN_API}${path}`, {
        ...init,
        headers: {
          authorization: `Bearer ${accessToken}`,
          ...(versioned && {
            'linkedin-version': this.version,
            'x-restli-protocol-version': '2.0.0',
          }),
          ...init.headers,
        },
        timeoutMs: init.timeoutMs ?? 30_000,
      });
    } catch (error) {
      throw this.rewrite(error);
    }
  }

  private async tokens(memberId: string): Promise<LinkedInTokens> {
    const key = this.key(memberId);
    const tokens = await this.sessions.load<LinkedInTokens>(key);
    if (!tokens) throw new PlatformApiError(RECONNECT, 401, false);
    if (this.fresh(tokens)) return tokens;
    if (!this.canRefresh(tokens)) {
      if (tokens.expiresAt > Date.now()) return tokens;
      throw new PlatformApiError(RECONNECT, 401, false);
    }

    return this.sessions.withLock(key, async (locked) => {
      // Another process may have refreshed while we waited for the lock.
      const current = await locked.load<LinkedInTokens>(key);
      if (!current) throw new PlatformApiError(RECONNECT, 401, false);
      if (this.fresh(current) || !this.canRefresh(current)) return current;
      const res = await this.tokenCall({
        grant_type: 'refresh_token',
        refresh_token: current.refreshToken!,
      }).catch((error: unknown) => {
        if (error instanceof PlatformApiError && !error.retryable) {
          throw new PlatformApiError(RECONNECT, 401, false);
        }
        throw error;
      });
      return this.store(memberId, res, current, locked);
    });
  }

  private fresh(tokens: LinkedInTokens): boolean {
    return tokens.expiresAt - REFRESH_MARGIN_MS > Date.now();
  }

  private canRefresh(tokens: LinkedInTokens): boolean {
    return Boolean(
      tokens.refreshToken && (tokens.refreshExpiresAt ?? 0) > Date.now(),
    );
  }

  private async tokenCall(
    form: Record<string, string>,
  ): Promise<LinkedInTokenResponse> {
    const { clientId, clientSecret } = this.app();
    const res = await requestJson<LinkedInTokenResponse>(
      `${OAUTH}/accessToken`,
      {
        form: { ...form, client_id: clientId, client_secret: clientSecret },
      },
    );
    if (!res?.access_token) {
      throw new PlatformApiError(
        'LinkedIn didn’t accept the sign-in. Try connecting again.',
        400,
        false,
      );
    }
    return res;
  }

  private async store(
    memberId: string,
    res: LinkedInTokenResponse,
    previous: LinkedInTokens | null = null,
    sessions: ProviderSessionStore = this.sessions,
  ): Promise<LinkedInTokens> {
    const now = Date.now();
    const tokens: LinkedInTokens = {
      accessToken: res.access_token,
      expiresAt: now + res.expires_in * 1000,
      // A refresh returns the same refresh token with its original expiry.
      refreshToken: res.refresh_token ?? previous?.refreshToken ?? null,
      refreshExpiresAt: res.refresh_token_expires_in
        ? now + res.refresh_token_expires_in * 1000
        : (previous?.refreshExpiresAt ?? null),
      scope: res.scope ?? previous?.scope ?? '',
    };
    await sessions.save(this.key(memberId), Platform.LinkedIn, tokens);
    return tokens;
  }

  private rewrite(error: unknown): unknown {
    if (!(error instanceof PlatformApiError) || error.status === 0)
      return error;
    const body = (error.body ?? {}) as LinkedInErrorBody;
    const detail = body.message ?? body.error_description ?? '';
    const status = error.status;
    if (status === 401)
      return new PlatformApiError(RECONNECT, 401, false, body);
    if (status === 403) {
      return new PlatformApiError(
        'LinkedIn didn’t allow this. Reconnect the account and approve every permission.',
        403,
        false,
        body,
      );
    }
    if (status === 429) {
      return new PlatformApiError(
        'LinkedIn is limiting how often Aby Socials can post or read right now. Members can post up to 150 times a day. Trying again later.',
        429,
        true,
        body,
      );
    }
    // LinkedIn answers 422 for a repeat of a recent post; not an access problem.
    if (/duplicate/i.test(detail)) {
      return new PlatformApiError(
        'LinkedIn rejected this as a duplicate of a recent post from this account. Change the text and try again.',
        409,
        false,
        body,
      );
    }
    return new PlatformApiError(
      detail
        ? `LinkedIn refused this: ${detail}`
        : 'LinkedIn refused this. Try again, or reconnect the account if it keeps happening.',
      status,
      status >= 500,
      body,
    );
  }

  private key(memberId: string): string {
    return `linkedin:${memberId}`;
  }

  private app() {
    if (!this.clientId || !this.clientSecret || !this.redirectUri) {
      throw new PlatformApiError(
        'LinkedIn isn’t available yet. Ask whoever runs Aby Socials to finish setting it up.',
        503,
        false,
        {
          missing:
            'LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, LINKEDIN_REDIRECT_URI',
        },
      );
    }
    return {
      clientId: this.clientId,
      clientSecret: this.clientSecret,
      redirectUri: this.redirectUri,
    };
  }
}
