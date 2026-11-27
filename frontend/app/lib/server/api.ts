import "server-only";
import type { NextRequest } from "next/server";
import { ACCESS_COOKIE, API_URL, REFRESH_COOKIE, refreshTokens, type TokenPair } from "./session";

export interface SessionCall {
  /** null when the API was unreachable. */
  upstream: Response | null;
  /** New tokens to store when the call had to refresh the session. */
  renewed: TokenPair | null;
  /** The session is gone: sign the user in again. */
  signedOut: boolean;
}

/** Calls `<API>/api/<path>` as the signed-in user, refreshing the session once on expiry. */
export async function callApiWithSession(
  request: NextRequest,
  path: string,
  init: { method: string; body?: string; contentType?: string; search?: string },
): Promise<SessionCall> {
  const target = new URL(`/api/${path}`, API_URL);
  if (init.search) target.search = init.search;

  let access = request.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  let renewed: TokenPair | null = null;

  if (!access && refresh) {
    renewed = await refreshTokens(refresh);
    access = renewed?.accessToken;
  }
  if (!access) return { upstream: null, renewed: null, signedOut: true };

  let upstream = await send(target, init, access);
  if (upstream?.status === 401 && refresh && !renewed) {
    renewed = await refreshTokens(refresh);
    if (!renewed) return { upstream: null, renewed: null, signedOut: true };
    upstream = await send(target, init, renewed.accessToken);
  }
  return { upstream, renewed, signedOut: upstream?.status === 401 };
}

async function send(
  target: URL,
  init: { method: string; body?: string; contentType?: string },
  accessToken: string,
): Promise<Response | null> {
  try {
    return await fetch(target, {
      method: init.method,
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: "application/json",
        ...(init.body !== undefined && { "content-type": init.contentType ?? "application/json" }),
      },
      body: init.body,
      redirect: "error",
      cache: "no-store",
    });
  } catch {
    return null;
  }
}
