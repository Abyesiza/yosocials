import "server-only";
import type { NextResponse } from "next/server";

// API tokens live only in httpOnly cookies that the /bff handlers read.
export const ACCESS_COOKIE = "ys_at";
export const REFRESH_COOKIE = "ys_rt";

export const API_URL = (process.env.API_URL ?? "http://localhost:4000").replace(
  /\/$/,
  "",
);

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

const base = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

// Matches the API's 30-day refresh token lifetime.
const REFRESH_MAX_AGE = 30 * 24 * 60 * 60;

export function setSessionCookies(res: NextResponse, tokens: TokenPair): void {
  res.cookies.set(ACCESS_COOKIE, tokens.accessToken, {
    ...base,
    // Expire early so we refresh before the API rejects the token.
    maxAge: Math.max(tokens.expiresIn - 30, 30),
  });
  res.cookies.set(REFRESH_COOKIE, tokens.refreshToken, {
    ...base,
    maxAge: REFRESH_MAX_AGE,
  });
}

export function clearSessionCookies(res: NextResponse): void {
  res.cookies.set(ACCESS_COOKIE, "", { ...base, maxAge: 0 });
  res.cookies.set(REFRESH_COOKIE, "", { ...base, maxAge: 0 });
}

// SameSite=Lax covers cross-site POSTs; this also covers sibling subdomains.
export function isSameOrigin(request: Request): boolean {
  if (request.method === "GET" || request.method === "HEAD") return true;
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function refreshTokens(
  refreshToken: string,
): Promise<TokenPair | null> {
  try {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      redirect: "error",
      cache: "no-store",
    });
    return res.ok ? ((await res.json()) as TokenPair) : null;
  } catch {
    return null;
  }
}
