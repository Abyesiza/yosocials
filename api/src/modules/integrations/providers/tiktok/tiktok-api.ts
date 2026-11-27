import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PlatformApiError,
  requestJson,
} from '../../../../common/http/http-client.js';
import { Platform } from '../../../../common/enums/platform.enum.js';
import type { EnvironmentVariables } from '../../../../config/env.validation.js';
import { ProviderSessionsService } from '../../sessions/provider-sessions.service.js';
import type { TikTokEnvelope, TikTokTokenResponse } from './tiktok.types.js';

const API = 'https://open.tiktokapis.com';
const AUTHORIZE_URL = 'https://www.tiktok.com/v2/auth/authorize/';
/** Refresh this long before the 24-hour access token runs out. */
const REFRESH_MARGIN_MS = 5 * 60_000;

/** OAuth tokens for one TikTok user, kept encrypted in the session store. */
interface TikTokTokens {
  accessToken: string;
  refreshToken: string;
  scope: string;
  expiresAt: number;
  refreshExpiresAt: number;
}

/** What TikTok's error codes mean for the person posting. */
const FRIENDLY: Record<string, string> = {
  access_token_invalid: 'TikTok access has expired. Reconnect the account.',
  scope_not_authorized:
    'This TikTok account didn’t allow the permission needed. Reconnect it and allow every permission.',
  spam_risk_too_many_posts:
    'This TikTok account has reached its daily posting limit. Try again later.',
  spam_risk_user_banned_from_posting:
    'TikTok isn’t letting this account post right now.',
  reached_active_user_cap:
    'TikTok’s daily limit of creators posting through Aby Socials was reached. Try again tomorrow.',
  unaudited_client_can_only_post_to_private_accounts:
    'Until TikTok finishes reviewing Aby Socials, posts can only be private. Choose “Only me”.',
  url_ownership_unverified:
    'TikTok couldn’t verify where the media is hosted. The media domain must be verified on the TikTok app.',
  privacy_level_option_mismatch:
    'That privacy setting isn’t available for this account. Pick one from the list.',
  rate_limit_exceeded:
    'TikTok is rate limiting requests. Trying again shortly.',
};

const STATUS_OF: Record<string, number> = {
  access_token_invalid: 401,
  scope_not_authorized: 403,
  rate_limit_exceeded: 429,
};

/**
 * TikTok API v2 client: the OAuth handshake, per-user tokens that refresh
 * themselves, and `{ data, error }` envelopes turned into PlatformApiErrors.
 */
@Injectable()
export class TikTokApi {
  private readonly clientKey?: string;
  private readonly clientSecret?: string;
  private readonly redirectUri?: string;
  private readonly scopes: string;

  constructor(
    config: ConfigService<EnvironmentVariables, true>,
    private readonly sessions: ProviderSessionsService,
  ) {
    this.clientKey = config.get('TIKTOK_CLIENT_KEY', { infer: true });
    this.clientSecret = config.get('TIKTOK_CLIENT_SECRET', { infer: true });
    this.redirectUri = config.get('TIKTOK_REDIRECT_URI', { infer: true });
    this.scopes = config.get('TIKTOK_SCOPES', { infer: true });
  }

  isConfigured(): boolean {
    return Boolean(this.clientKey && this.clientSecret && this.redirectUri);
  }

  authorizeUrl(state: string): string {
    const { clientKey, redirectUri } = this.app();
    const url = new URL(AUTHORIZE_URL);
    url.search = new URLSearchParams({
      client_key: clientKey,
      scope: this.scopes,
      response_type: 'code',
      redirect_uri: redirectUri,
      state,
    }).toString();
    return url.toString();
  }

  /** Trades the authorization code for tokens and stores them. Returns the user's open id. */
  async exchangeCode(code: string): Promise<string> {
    const { clientKey, clientSecret, redirectUri } = this.app();
    const res = await this.tokenCall({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    });
    await this.store(res);
    return res.open_id;
  }

  async grantedScopes(openId: string): Promise<Set<string>> {
    return new Set((await this.tokens(openId)).scope.split(','));
  }

  /** Calls the API as this user and unwraps the envelope. */
  async call<T>(
    openId: string,
    path: string,
    init: {
      json?: unknown;
      query?: Record<string, string>;
      bigIntsAsStrings?: boolean;
    } = {},
  ): Promise<T> {
    const { accessToken } = await this.tokens(openId);
    let body: TikTokEnvelope<T>;
    try {
      body = await requestJson<TikTokEnvelope<T>>(`${API}${path}`, {
        method: init.json === undefined ? 'GET' : 'POST',
        headers: { authorization: `Bearer ${accessToken}` },
        json: init.json,
        query: init.query,
        bigIntsAsStrings: init.bigIntsAsStrings,
        timeoutMs: 30_000,
      });
    } catch (error) {
      throw this.rewrite(error);
    }
    if (body.error && body.error.code !== 'ok') {
      throw this.toError(body.error.code, body.error.message, 400);
    }
    return body.data as T;
  }

  /** Revokes the user's tokens on TikTok and forgets them. Best effort. */
  async revoke(openId: string): Promise<void> {
    const tokens = await this.sessions.load<TikTokTokens>(this.key(openId));
    await this.sessions.remove(this.key(openId));
    if (!tokens || !this.isConfigured()) return;
    const { clientKey, clientSecret } = this.app();
    await requestJson(`${API}/v2/oauth/revoke/`, {
      form: {
        client_key: clientKey,
        client_secret: clientSecret,
        token: tokens.accessToken,
      },
    }).catch(() => undefined);
  }

  private async tokens(openId: string): Promise<TikTokTokens> {
    const tokens = await this.sessions.load<TikTokTokens>(this.key(openId));
    if (!tokens || tokens.refreshExpiresAt < Date.now()) {
      throw new PlatformApiError(FRIENDLY.access_token_invalid, 401, false);
    }
    if (tokens.expiresAt - REFRESH_MARGIN_MS > Date.now()) return tokens;

    const { clientKey, clientSecret } = this.app();
    const res = await this.tokenCall({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: tokens.refreshToken,
    }).catch((error: unknown) => {
      if (error instanceof PlatformApiError && !error.retryable) {
        throw new PlatformApiError(FRIENDLY.access_token_invalid, 401, false);
      }
      throw error;
    });
    return this.store(res);
  }

  private async tokenCall(
    form: Record<string, string>,
  ): Promise<TikTokTokenResponse> {
    const res = await requestJson<TikTokTokenResponse>(
      `${API}/v2/oauth/token/`,
      { form },
    );
    // TikTok can answer 200 with an error body.
    if (res.error || !res.access_token) {
      throw new PlatformApiError(
        res.error_description || res.error || 'TikTok rejected the sign-in',
        400,
        false,
      );
    }
    return res;
  }

  private async store(res: TikTokTokenResponse): Promise<TikTokTokens> {
    const now = Date.now();
    const tokens: TikTokTokens = {
      accessToken: res.access_token,
      refreshToken: res.refresh_token,
      scope: res.scope,
      expiresAt: now + res.expires_in * 1000,
      refreshExpiresAt: now + res.refresh_expires_in * 1000,
    };
    await this.sessions.save(this.key(res.open_id), Platform.TikTok, tokens);
    return tokens;
  }

  private rewrite(error: unknown): unknown {
    if (!(error instanceof PlatformApiError)) return error;
    const code = (error.body as TikTokEnvelope<unknown> | undefined)?.error
      ?.code;
    return code ? this.toError(code, error.message, error.status) : error;
  }

  private toError(code: string, message: string, status: number) {
    const finalStatus = STATUS_OF[code] ?? status;
    return new PlatformApiError(
      FRIENDLY[code] ?? (message || `TikTok error: ${code}`),
      finalStatus,
      finalStatus === 429 || finalStatus >= 500,
      { code },
    );
  }

  private key(openId: string): string {
    return `tiktok:${openId}`;
  }

  private app() {
    if (!this.clientKey || !this.clientSecret || !this.redirectUri) {
      throw new PlatformApiError(
        'TikTok isn’t set up yet (TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET and TIKTOK_REDIRECT_URI)',
        503,
        false,
      );
    }
    return {
      clientKey: this.clientKey,
      clientSecret: this.clientSecret,
      redirectUri: this.redirectUri,
    };
  }
}
