import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { setSessionCookies, type TokenPair } from "./session";

/** Platforms that connect through their own sign-in page. */
export const OAUTH_PLATFORMS = ["tiktok", "x"] as const;
export type OAuthPlatform = (typeof OAUTH_PLATFORMS)[number];

export const isOAuthPlatform = (p: string): p is OAuthPlatform =>
  (OAUTH_PLATFORMS as readonly string[]).includes(p);

/** Holds the expected state between leaving for the platform and coming back. */
export const OAUTH_COOKIE = "ys_oauth";
export const OAUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  // Lax still reaches us on the platform's top-level redirect back.
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/integrations",
  maxAge: 15 * 60,
};

export interface OAuthCookie {
  state: string;
  workspaceId: string;
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Redirects to a page in the app, carrying any refreshed session along. */
export function redirectTo(request: NextRequest, path: string, renewed: TokenPair | null): NextResponse {
  const res = NextResponse.redirect(new URL(path, request.url), 303);
  if (renewed) setSessionCookies(res, renewed);
  return res;
}

export function accountsPage(workspaceId: string, params: Record<string, string>): string {
  return `/w/${workspaceId}/accounts?${new URLSearchParams(params).toString()}`;
}

/** Nest sends `message` as a string, or a list for validation errors. */
export async function apiMessage(res: Response | null, fallback: string): Promise<string> {
  if (!res) return "The Aby Socials API is not reachable. Try again.";
  const body = (await res.json().catch(() => null)) as { message?: unknown } | null;
  const m = body?.message;
  if (Array.isArray(m)) return m.join(" ");
  return typeof m === "string" ? m : fallback;
}
