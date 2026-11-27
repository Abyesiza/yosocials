import { NextResponse, type NextRequest } from "next/server";
import {
  API_URL,
  clearSessionCookies,
  isSameOrigin,
  REFRESH_COOKIE,
  setSessionCookies,
  type TokenPair,
} from "@/app/lib/server/session";

// Tokens from the API go into httpOnly cookies and never reach the browser.

type Context = { params: Promise<{ action: string }> };

const PASSTHROUGH = new Map([
  ["signin", "/api/auth/signin"],
  ["signup", "/api/auth/signup"],
]);

export async function POST(request: NextRequest, { params }: Context) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ message: "Cross-site request refused" }, { status: 403 });
  }
  const { action } = await params;

  if (action === "signout") return signOut(request);

  const path = PASSTHROUGH.get(action);
  if (!path) return NextResponse.json({ message: "Not found" }, { status: 404 });

  let upstream: Response;
  try {
    upstream = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: await request.text(),
      redirect: "error",
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { message: "The Aby Socials API is not reachable" },
      { status: 502 },
    );
  }

  const data = (await upstream.json().catch(() => ({}))) as {
    tokens?: TokenPair;
  } & Record<string, unknown>;
  if (!upstream.ok || !data.tokens) {
    return NextResponse.json(data, { status: upstream.status });
  }

  const { tokens, ...rest } = data;
  const res = NextResponse.json(rest, { status: upstream.status });
  setSessionCookies(res, tokens);
  return res;
}

async function signOut(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (refreshToken) {
    await fetch(`${API_URL}/api/auth/signout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      redirect: "error",
      cache: "no-store",
    }).catch(() => undefined);
  }
  const res = new NextResponse(null, { status: 204 });
  clearSessionCookies(res);
  return res;
}
