import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Platform } from '../../common/enums/platform.enum.js';
import type { EnvironmentVariables } from '../../config/env.validation.js';

/** A sign-in round trip must finish within this long. */
const TTL_MS = 15 * 60_000;

export interface OAuthState {
  workspaceId: string;
  userId: string;
  platform: Platform;
}

interface Payload {
  w: string;
  u: string;
  p: Platform;
  e: number;
  n: string;
}

/**
 * The OAuth `state` parameter: a signed, expiring note of who started the
 * sign-in and for which workspace, so a callback can't be replayed into
 * another user's workspace (login CSRF).
 */
@Injectable()
export class OAuthStateService {
  private readonly key: Buffer;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    // A separate key per purpose, derived from the JWT secret.
    this.key = createHmac(
      'sha256',
      Buffer.from(config.get('JWT_SECRET', { infer: true }), 'base64'),
    )
      .update('oauth-state')
      .digest();
  }

  sign(state: OAuthState): string {
    const payload: Payload = {
      w: state.workspaceId,
      u: state.userId,
      p: state.platform,
      e: Date.now() + TTL_MS,
      n: randomBytes(8).toString('base64url'),
    };
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${body}.${this.mac(body)}`;
  }

  verify(token: string, expected: OAuthState): void {
    const [body, mac] = token.split('.');
    const valid =
      body && mac && mac.length === this.mac(body).length
        ? timingSafeEqual(Buffer.from(mac), Buffer.from(this.mac(body)))
        : false;
    if (!valid)
      throw new BadRequestException(
        'The sign-in link is invalid. Start again.',
      );

    const payload = JSON.parse(
      Buffer.from(body!, 'base64url').toString(),
    ) as Payload;
    if (payload.e < Date.now()) {
      throw new BadRequestException('The sign-in took too long. Start again.');
    }
    if (
      payload.w !== expected.workspaceId ||
      payload.u !== expected.userId ||
      payload.p !== expected.platform
    ) {
      throw new BadRequestException(
        'This sign-in was started by someone else, or for another workspace.',
      );
    }
  }

  private mac(body: string): string {
    return createHmac('sha256', this.key).update(body).digest('base64url');
  }
}
