"use client";

import useSWR, { type SWRConfiguration } from "swr";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Nest sends `message` as a string, or a list for validation errors.
function messageOf(body: unknown, status: number): string {
  if (body && typeof body === "object" && "message" in body) {
    const m = (body as { message: unknown }).message;
    if (Array.isArray(m)) return m.join("\n");
    if (typeof m === "string") return m;
  }
  return fallbackMessage(status);
}

function fallbackMessage(status: number): string {
  if (status === 401) return "Your session has ended. Log in again to continue.";
  if (status === 403) return "You don’t have permission to do that. Ask a workspace admin.";
  if (status === 404) return "We couldn’t find that. It may have been deleted.";
  if (status === 409) return "This changed while you were working. Reload the page and try again.";
  if (status === 413) return "That file is too large to upload.";
  if (status === 429) return "That’s a lot of requests in a short time. Wait a minute, then try again.";
  if (status >= 500) return "We couldn’t reach our server. Try again in a moment.";
  return "We couldn’t do that. Check the details and try again.";
}

export async function api<T>(
  path: string,
  init: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(`/bff${path}`, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    headers: init.body === undefined ? undefined : { "content-type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    credentials: "same-origin",
  });

  if (res.status === 401 && typeof window !== "undefined") {
    const next = window.location.pathname + window.location.search;
    // A full reload drops every cached response of the ended session.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/signin?next=${encodeURIComponent(next)}`);
  }
  if (res.status === 204) return undefined as T;

  const body: unknown = await res.json().catch(() => undefined);
  if (!res.ok) throw new ApiError(messageOf(body, res.status), res.status);
  return body as T;
}

export async function authCall<T>(action: "signin" | "signup" | "signout", body?: unknown) {
  const res = await fetch(`/bff/auth/${action}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
    credentials: "same-origin",
  });
  if (res.status === 204) return undefined as T;
  const data: unknown = await res.json().catch(() => undefined);
  if (!res.ok) throw new ApiError(messageOf(data, res.status), res.status);
  return data as T;
}

export function useApi<T>(path: string | null, config?: SWRConfiguration<T, ApiError>) {
  return useSWR<T, ApiError>(path, (p: string) => api<T>(p), {
    revalidateOnFocus: true,
    ...config,
  });
}
