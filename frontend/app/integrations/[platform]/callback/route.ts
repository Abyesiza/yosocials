import { NextResponse, type NextRequest } from "next/server";
import { callApiWithSession } from "@/app/lib/server/api";
import {
  accountsPage,
  apiMessage,
  isOAuthPlatform,
  OAUTH_COOKIE,
  OAUTH_COOKIE_OPTIONS,
  redirectTo,
  UUID,
  type OAuthCookie,
} from "@/app/lib/server/oauth";
import { platformLabel } from "@/app/components/ui/platform";

// The platform sends the user back here (TIKTOK_REDIRECT_URI, X_REDIRECT_URI) with a code, or an error.
export async function GET(request: NextRequest, { params }: RouteContext<"/integrations/[platform]/callback">) {
  const { platform } = await params;
  if (!isOAuthPlatform(platform)) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const query = request.nextUrl.searchParams;
  const saved = readCookie(request);
  if (!saved || saved.state !== query.get("state")) {
    // Stale, replayed or started in another browser: never act on it.
    return finish(redirectTo(request, saved ? accountsPage(saved.workspaceId, { connect_error: "That sign-in didn’t match the one started here. Try again." }) : "/dashboard", null));
  }

  const back = (params: Record<string, string>, renewed = null as Parameters<typeof redirectTo>[2]) =>
    finish(redirectTo(request, accountsPage(saved.workspaceId, params), renewed));

  const code = query.get("code");
  if (!code) {
    const denied = query.get("error") === "access_denied";
    return back({
      connect_error: denied
        ? `You didn’t allow access on ${platformLabel(platform)}, so nothing was connected.`
        : (query.get("error_description") ?? `${platformLabel(platform)} didn’t finish the sign-in. Try again.`),
    });
  }

  const { upstream, renewed, signedOut } = await callApiWithSession(
    request,
    `workspaces/${saved.workspaceId}/accounts/oauth/${platform}/callback`,
    { method: "POST", body: JSON.stringify({ code, state: saved.state }) },
  );
  if (signedOut) {
    return finish(NextResponse.redirect(new URL("/signin", request.url), 303));
  }
  if (!upstream?.ok) {
    return back({ connect_error: await apiMessage(upstream, "Couldn’t connect the account. Try again.") }, renewed);
  }
  return back({ connected: platform }, renewed);
}

function readCookie(request: NextRequest): OAuthCookie | null {
  try {
    const value = JSON.parse(request.cookies.get(OAUTH_COOKIE)?.value ?? "") as Partial<OAuthCookie>;
    return typeof value.state === "string" && typeof value.workspaceId === "string" && UUID.test(value.workspaceId)
      ? { state: value.state, workspaceId: value.workspaceId }
      : null;
  } catch {
    return null;
  }
}

/** The state is single use. */
function finish(res: NextResponse): NextResponse {
  res.cookies.set(OAUTH_COOKIE, "", { ...OAUTH_COOKIE_OPTIONS, maxAge: 0 });
  return res;
}
