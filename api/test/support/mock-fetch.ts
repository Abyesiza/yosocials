import type { Mock } from 'vitest';

export interface RecordedRequest {
  method: string;
  url: URL;
  headers: Record<string, string>;
  body: unknown;
}

type Handler = (req: RecordedRequest) => { status?: number; body?: unknown };

/**
 * Replaces global fetch with a router over `METHOD host/path` keys, and
 * records every call. Unmatched requests fail the test loudly.
 */
export function mockFetch(routes: Record<string, Handler>) {
  const calls: RecordedRequest[] = [];
  const fn: Mock = vi.fn(
    async (input: URL | string, init: RequestInit = {}) => {
      const url = new URL(String(input));
      const req: RecordedRequest = {
        method: init.method ?? 'GET',
        url,
        headers: (init.headers ?? {}) as Record<string, string>,
        body: init.body ? JSON.parse(init.body as string) : undefined,
      };
      calls.push(req);
      const key = `${req.method} ${url.host}${url.pathname}`;
      const handler = routes[key];
      if (!handler) throw new Error(`Unexpected request: ${key}`);
      const { status = 200, body } = handler(req);
      return new Response(body === undefined ? null : JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      });
    },
  );
  vi.stubGlobal('fetch', fn);
  return { calls, fn };
}
