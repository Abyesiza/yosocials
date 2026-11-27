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

// `/integrations/<platform>/start?workspace=<id>`: asks the API for a signed state, then leaves for the platform.
export async function GET(request: NextRequest, { params }: RouteContext<"/integrations/[platform]/start">) {
  const { platform } = await params;
  const workspaceId = request.nextUrl.searchParams.get("workspace") ?? "";
  if (!isOAuthPlatform(platform) || !UUID.test(workspaceId)) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const { upstream, renewed, signedOut } = await callApiWithSession(
    request,
    `workspaces/${workspaceId}/accounts/oauth/${platform}/start`,
    { method: "POST" },
  );
  if (signedOut) {
    const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    return NextResponse.redirect(new URL(`/signin?next=${encodeURIComponent(next)}`, request.url), 303);
  }
  if (!upstream?.ok) {
    const message = await apiMessage(upstream, "Couldn’t start connecting. Try again.");
    return redirectTo(request, accountsPage(workspaceId, { connect_error: message }), renewed);
  }

  const { url, state } = (await upstream.json()) as { url: string; state: string };
  const res = NextResponse.redirect(url, 303);
  const cookie: OAuthCookie = { state, workspaceId };
  res.cookies.set(OAUTH_COOKIE, JSON.stringify(cookie), OAUTH_COOKIE_OPTIONS);
  return res;
}
