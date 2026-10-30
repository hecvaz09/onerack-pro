import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/login-session";
export async function POST(request: NextRequest) {
  const origin = process.env.RACKLAB_PUBLIC_ORIGIN;
  if (!origin || request.headers.get("origin") !== origin) return new NextResponse(null, { status: 403 });
  const response = NextResponse.redirect(new URL("/login", origin), 303);
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
