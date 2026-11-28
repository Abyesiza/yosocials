import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import type { EnvironmentVariables } from '../../config/env.validation.js';

const WINDOW_MS = 60_000;
const PRUNE_THRESHOLD = 10_000;

interface Hit {
  count: number;
  resetAt: number;
}

/**
 * Per-IP, per-route fixed-window rate limit (AUTH_RATE_LIMIT_PER_MINUTE).
 * In-memory, so the limit applies per process/instance.
 *
 * Replaces @nestjs/throttler, which ships as CommonJS and cannot require()
 * the ESM-only Nest 12 packages on runtimes without require(esm) support.
 */
@Injectable()
export class ThrottleGuard implements CanActivate {
  private readonly hits = new Map<string, Hit>();
  private readonly limit: number;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    this.limit = config.get('AUTH_RATE_LIMIT_PER_MINUTE', { infer: true });
  }

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const now = Date.now();
    const key = `${context.getClass().name}:${context.getHandler().name}:${req.ip ?? 'unknown'}`;

    if (this.hits.size > PRUNE_THRESHOLD) this.prune(now);

    let hit = this.hits.get(key);
    if (!hit || hit.resetAt <= now) {
      hit = { count: 0, resetAt: now + WINDOW_MS };
      this.hits.set(key, hit);
    }
    hit.count += 1;

    if (hit.count > this.limit) {
      res.setHeader('Retry-After', Math.ceil((hit.resetAt - now) / 1000));
      throw new HttpException(
        'Too many attempts. Wait a minute, then try again.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }

  private prune(now: number): void {
    for (const [key, hit] of this.hits) {
      if (hit.resetAt <= now) this.hits.delete(key);
    }
  }
}
