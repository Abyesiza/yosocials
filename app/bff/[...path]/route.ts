import { NextResponse, type NextRequest } from "next/server";
import {
  ACCESS_COOKIE,
  API_URL,
  clearSessionCookies,
  isSameOrigin,
  REFRESH_COOKIE,
  refreshTokens,
  setSessionCookies,
  type TokenPair,
} from "@/app/lib/server/session";

// `/bff/<path>` → `<API>/api/<path>` with the session token, refreshing once on expiry.

type Context = { params: Promise<{ path: string[] }> };

async function handle(request: NextRequest, { params }: Context) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ message: "Cross-site request refused" }, { status: 403 });
  }

  const { path } = await params;
  if (path[0] === "auth") {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  // Re-encoding each segment keeps the request inside /api on a fixed origin.
  const target = new URL(
    `/api/${path.map(encodeURIComponent).join("/")}`,
    API_URL,
  );
  target.search = request.nextUrl.search;

  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.text();

  let access = request.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  let renewed: TokenPair | null = null;

  if (!access && refresh) {
    renewed = await refreshTokens(refresh);
    access = renewed?.accessToken;
  }
  if (!access) return unauthorized();

  let upstream = await send(target, request, body, access);

  if (upstream?.status === 401 && refresh && !renewed) {
    renewed = await refreshTokens(refresh);
    if (!renewed) return unauthorized();
    upstream = await send(target, request, body, renewed.accessToken);
  }
  if (!upstream) {
    return NextResponse.json(
      { message: "The Yo Socials API is not reachable" },
      { status: 502 },
    );
  }
  if (upstream.status === 401) return unauthorized();

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

async function send(
  target: URL,
  request: NextRequest,
  body: string | undefined,
  accessToken: string,
): Promise<Response | null> {
  try {
    return await fetch(target, {
      method: request.method,
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: "application/json",
        ...(body !== undefined && {
          "content-type": request.headers.get("content-type") ?? "application/json",
        }),
      },
      body,
      redirect: "error",
      cache: "no-store",
    });
  } catch {
    return null;
  }
}

function unauthorized() {
  const res = NextResponse.json(
    { message: "Your session has ended. Please sign in again." },
    { status: 401 },
  );
  clearSessionCookies(res);
  return res;
}

export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
