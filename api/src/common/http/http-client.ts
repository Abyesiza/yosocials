/**
 * Thin, typed wrapper over global `fetch` shared by all platform providers.
 * Every non-2xx response becomes a `PlatformApiError` carrying the status and
 * the platform's own error message, so callers never parse raw responses.
 */
export class PlatformApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** True when retrying later may succeed (rate limits, 5xx, timeouts). */
    readonly retryable: boolean,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'PlatformApiError';
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  query?: Record<string, string | string[] | undefined>;
  json?: unknown;
  /** Sent as application/x-www-form-urlencoded (OAuth token endpoints). */
  form?: Record<string, string>;
  /** Sent as multipart/form-data (file uploads); fetch sets the boundary. */
  multipart?: FormData;
  /** Sent as-is, e.g. file bytes PUT to a signed upload URL. */
  binary?: { data: Blob; contentType: string };
  timeoutMs?: number;
  /** Parse integers too big for a JS number (e.g. TikTok video ids) as strings. */
  bigIntsAsStrings?: boolean;
}

const DEFAULT_TIMEOUT_MS = 15_000;

export async function requestJson<T>(
  url: string,
  options: RequestOptions = {},
): Promise<T> {
  return (await requestWithHeaders<T>(url, options)).body;
}

/** `requestJson`, plus the response headers (ids and ETags some platforms only send there). */
export async function requestWithHeaders<T>(
  url: string,
  options: RequestOptions = {},
): Promise<{ body: T; headers: Headers }> {
  const target = new URL(url);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value]) {
      target.searchParams.append(key, v);
    }
  }

  const headers: Record<string, string> = {
    accept: 'application/json',
    ...options.headers,
  };
  if (options.json !== undefined) headers['content-type'] = 'application/json';
  if (options.form !== undefined) {
    headers['content-type'] = 'application/x-www-form-urlencoded';
  }
  if (options.binary) headers['content-type'] = options.binary.contentType;
  const payload: BodyInit | undefined =
    options.binary?.data ??
    options.multipart ??
    (options.form !== undefined
      ? new URLSearchParams(options.form).toString()
      : options.json === undefined
        ? undefined
        : JSON.stringify(options.json));

  let response: Response;
  try {
    response = await fetch(target, {
      method: options.method ?? (payload === undefined ? 'GET' : 'POST'),
      headers,
      body: payload,
      signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new PlatformApiError(
      `We couldn’t reach ${target.host}. Try again in a moment.`,
      0,
      true,
      { reason },
    );
  }

  const text = await response.text();
  const body: unknown = text
    ? safeParse(options.bigIntsAsStrings ? quoteBigInts(text) : text)
    : undefined;

  if (!response.ok) {
    const retryable = response.status === 429 || response.status >= 500;
    throw new PlatformApiError(
      extractMessage(body) ??
        (retryable
          ? `${target.host} isn’t responding properly right now. Try again in a moment.`
          : `${target.host} didn’t accept the request.`),
      response.status,
      retryable,
      body,
    );
  }
  return { body: body as T, headers: response.headers };
}

/** Quotes bare integers of 16+ digits in JSON array or field positions, before JSON.parse rounds them. */
function quoteBigInts(text: string): string {
  return text.replace(/([[:,]\s*)(-?\d{16,})(?=\s*[,\]}])/g, '$1"$2"');
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Pulls a human-readable message out of the error shapes the platforms use. */
function extractMessage(body: unknown): string | undefined {
  if (typeof body === 'string') return body.slice(0, 300) || undefined;
  if (!body || typeof body !== 'object') return undefined;
  const record = body as Record<string, unknown>;
  for (const key of ['message', 'error_description', 'description', 'error']) {
    if (typeof record[key] === 'string' && record[key]) return record[key];
  }
  // TikTok nests it: { error: { code, message } }.
  if (record.error && typeof record.error === 'object') {
    return extractMessage(record.error);
  }
  return undefined;
}
