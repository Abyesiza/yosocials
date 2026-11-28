import {
  parseRetryAfter,
  PlatformApiError,
  requestJson,
} from './http-client.js';

const NOW = Date.parse('2026-12-01T10:00:00Z');

describe('parseRetryAfter', () => {
  it('reads Retry-After in seconds or as a date', () => {
    expect(
      parseRetryAfter(new Headers({ 'retry-after': '120' }), {}, NOW),
    ).toBe(120_000);
    expect(
      parseRetryAfter(
        new Headers({ 'retry-after': 'Tue, 01 Dec 2026 10:05:00 GMT' }),
        {},
        NOW,
      ),
    ).toBe(300_000);
  });

  it('reads Discord’s and Telegram’s retry_after from the body', () => {
    expect(
      parseRetryAfter(
        new Headers(),
        { message: 'rate', retry_after: 1.5 },
        NOW,
      ),
    ).toBe(1500);
    expect(
      parseRetryAfter(
        new Headers(),
        { ok: false, error_code: 429, parameters: { retry_after: 35 } },
        NOW,
      ),
    ).toBe(35_000);
  });

  it('reads X’s epoch reset and Mastodon’s ISO reset', () => {
    expect(
      parseRetryAfter(
        new Headers({ 'x-rate-limit-reset': String(NOW / 1000 + 900) }),
        undefined,
        NOW,
      ),
    ).toBe(900_000);
    expect(
      parseRetryAfter(
        new Headers({ 'x-ratelimit-reset': '2026-12-01T10:30:00.000Z' }),
        {},
        NOW,
      ),
    ).toBe(1_800_000);
  });

  it('never waits a negative time, and ignores what it can’t read', () => {
    expect(
      parseRetryAfter(
        new Headers({ 'x-ratelimit-reset': '2026-12-01T09:00:00.000Z' }),
        {},
        NOW,
      ),
    ).toBe(0);
    expect(
      parseRetryAfter(new Headers({ 'retry-after': 'soon' }), 'busy', NOW),
    ).toBeUndefined();
  });
});

describe('requestJson', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('attaches the wait to a 429, and only to a 429', async () => {
    const respond = (status: number) =>
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'slow down' }), {
            status,
            headers: { 'retry-after': '30' },
          }),
      );
    vi.stubGlobal('fetch', respond(429));
    const limited = await requestJson('https://api.example/x').catch(
      (e: unknown) => e,
    );
    expect(limited).toBeInstanceOf(PlatformApiError);
    expect(limited).toMatchObject({ retryable: true, retryAfterMs: 30_000 });

    vi.stubGlobal('fetch', respond(503));
    const down = await requestJson('https://api.example/x').catch(
      (e: unknown) => e,
    );
    expect(down).toMatchObject({ retryable: true, retryAfterMs: undefined });
  });
});
