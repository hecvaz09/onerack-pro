import { NextRequest, NextResponse } from "next/server";
import { authEnabled, authReady, SESSION_COOKIE, validSession } from "./lib/login-session";

export function proxy(request: NextRequest) {
  if (!authEnabled()) return NextResponse.next();
  const path = request.nextUrl.pathname;
  // Only login resources and a data-free container health probe are public.
  if ((request.method === "GET" || request.method === "HEAD") && (path === "/login" || path === "/api/health" || path.startsWith("/_next/static/"))) return NextResponse.next();
  if (path === "/api/session" || path === "/api/session/logout") return NextResponse.next();
  if (!authReady()) return new NextResponse("Sign-in is temporarily unavailable.", { status: 503 });
  if (validSession(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  if (path.startsWith("/api/") || !["GET", "HEAD"].includes(request.method)) return NextResponse.json({ error: "Sign in to continue." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const url = new URL("/login", process.env.RACKLAB_PUBLIC_ORIGIN || request.url);
  url.searchParams.set("next", path + request.nextUrl.search);
  const response = NextResponse.redirect(url, 303);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
