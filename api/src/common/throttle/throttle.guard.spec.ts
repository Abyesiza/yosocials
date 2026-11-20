import { type ExecutionContext, HttpException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EnvironmentVariables } from '../../config/env.validation.js';
import { ThrottleGuard } from './throttle.guard.js';

class AuthController {}
function signIn() {}
function signUp() {}

function contextFor(handler: () => void, ip = '1.2.3.4') {
  const setHeader = vi.fn();
  const context = {
    switchToHttp: () => ({
      getRequest: () => ({ ip }),
      getResponse: () => ({ setHeader }),
    }),
    getClass: () => AuthController,
    getHandler: () => handler,
  } as unknown as ExecutionContext;
  return { context, setHeader };
}

function guardWithLimit(limit: number) {
  const config = { get: () => limit } as unknown as ConfigService<
    EnvironmentVariables,
    true
  >;
  return new ThrottleGuard(config);
}

describe('ThrottleGuard', () => {
  afterEach(() => vi.useRealTimers());

  it('allows up to the limit, then rejects with 429 and Retry-After', () => {
    const guard = guardWithLimit(2);
    const { context, setHeader } = contextFor(signIn);

    expect(guard.canActivate(context)).toBe(true);
    expect(guard.canActivate(context)).toBe(true);
    try {
      guard.canActivate(context);
      expect.unreachable();
    } catch (error) {
      expect((error as HttpException).getStatus()).toBe(429);
    }
    expect(setHeader).toHaveBeenCalledWith('Retry-After', 60);
  });

  it('tracks each route and IP separately', () => {
    const guard = guardWithLimit(1);
    expect(guard.canActivate(contextFor(signIn).context)).toBe(true);
    expect(guard.canActivate(contextFor(signUp).context)).toBe(true);
    expect(guard.canActivate(contextFor(signIn, '5.6.7.8').context)).toBe(true);
  });

  it('resets after the window elapses', () => {
    vi.useFakeTimers();
    const guard = guardWithLimit(1);
    const { context } = contextFor(signIn);

    expect(guard.canActivate(context)).toBe(true);
    expect(() => guard.canActivate(context)).toThrow(HttpException);
    vi.advanceTimersByTime(60_000);
    expect(guard.canActivate(context)).toBe(true);
  });
});
