import type { Mock } from 'vitest';

export interface RecordedRequest {
  method: string;
  url: URL;
  headers: Record<string, string>;
  body: unknown;
}

type Handler = (req: RecordedRequest) => { status?: number; body?: unknown };

function headersOf(init: HeadersInit | undefined): Record<string, string> {
  return Object.fromEntries(new Headers(init).entries());
}

async function bodyOf(
  raw: BodyInit | null | undefined,
  contentType: string | undefined,
): Promise<unknown> {
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw === 'string')
    return contentType?.includes('json') ? JSON.parse(raw) : raw;
  return new Uint8Array(await new Response(raw).arrayBuffer());
}

/** Replaces global fetch with a router over `METHOD host/path` keys; unmatched requests fail loudly. */
export function mockFetch(routes: Record<string, Handler>) {
  const calls: RecordedRequest[] = [];
  const fn: Mock = vi.fn(
    async (input: URL | string | Request, init: RequestInit = {}) => {
      const request = input instanceof Request ? input : undefined;
      const url = new URL(
        request ? request.url : (input as string | URL).toString(),
      );
      const headers = headersOf(request?.headers ?? init.headers);
      const raw = request
        ? request.body
          ? await request.clone().arrayBuffer()
          : undefined
        : init.body;
      const body =
        raw instanceof ArrayBuffer && headers['content-type']?.includes('json')
          ? JSON.parse(new TextDecoder().decode(raw))
          : await bodyOf(raw as BodyInit | undefined, headers['content-type']);
      const req: RecordedRequest = {
        method: request?.method ?? init.method ?? 'GET',
        url,
        headers,
        body,
      };
      calls.push(req);
      const key = `${req.method} ${url.host}${url.pathname}`;
      const handler = routes[key];
      if (!handler) throw new Error(`Unexpected request: ${key}`);
      const { status = 200, body: payload } = handler(req);
      return new Response(
        payload === undefined ? null : JSON.stringify(payload),
        {
          status,
          headers: { 'content-type': 'application/json' },
        },
      );
    },
  );
  vi.stubGlobal('fetch', fn);
  return { calls, fn };
}
