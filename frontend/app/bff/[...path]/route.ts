import { NextResponse, type NextRequest } from "next/server";
import { callApiWithSession } from "@/app/lib/server/api";
import {
  clearSessionCookies,
  isSameOrigin,
  setSessionCookies,
  type TokenPair,
} from "@/app/lib/server/session";

// `/bff/<path>` → `<API>/api/<path>` with the session token, refreshing once on expiry.

type Context = { params: Promise<{ path: string[] }> };

async function handle(request: NextRequest, { params }: Context) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ message: "We couldn’t check where this request came from. Reload the page and try again." }, { status: 403 });
  }

  const { path } = await params;
  if (path[0] === "auth") {
    return NextResponse.json({ message: "We couldn’t find that page." }, { status: 404 });
  }
  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.text();

  // Re-encoding each segment keeps the request inside /api on a fixed origin.
  const { upstream, renewed, signedOut } = await callApiWithSession(
    request,
    path.map(encodeURIComponent).join("/"),
    {
      method: request.method,
      body,
      contentType: request.headers.get("content-type") ?? undefined,
      search: request.nextUrl.search,
    },
  );
  if (signedOut) return unauthorized();
  if (!upstream) {
    return NextResponse.json(
      { message: "We couldn’t reach our server. Try again in a moment." },
      { status: 502 },
    );
  }

  // A deleted account has no session left to keep.
  if (path.join("/") === "me" && request.method === "DELETE" && upstream.ok) {
    const res = new NextResponse(null, { status: 204 });
    clearSessionCookies(res);
    return res;
  }

  // A password change revokes every session and returns this device's new tokens.
  if (path.join("/") === "me/password" && upstream.ok) {
    const tokens = (await upstream.json()) as TokenPair;
    const res = new NextResponse(null, { status: 204 });
    setSessionCookies(res, tokens);
    return res;
  }

  const res = new NextResponse(
    upstream.status === 204 ? null : await upstream.arrayBuffer(),
    {
      status: upstream.status,
      headers: {
        "content-type":
          upstream.headers.get("content-type") ?? "application/json",
        "cache-control": "no-store",
      },
    },
  );
  if (renewed) setSessionCookies(res, renewed);
  return res;
}

function unauthorized() {
  const res = NextResponse.json(
    { message: "Your session has ended. Log in again to continue." },
    { status: 401 },
  );
  clearSessionCookies(res);
  return res;
}

export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
