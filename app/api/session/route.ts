import { NextRequest, NextResponse } from "next/server";
import { authEnabled, authReady, issueSession, safeDestination, SESSION_COOKIE, SESSION_SECONDS, validCredentials } from "@/lib/login-session";

export const runtime = "nodejs";
// One app process on this VPS. Nginx also applies a persistent per-IP rate limit.
const attempts = new Map<string, { count: number; until: number }>();
export async function POST(request: NextRequest) {
  const origin = process.env.RACKLAB_PUBLIC_ORIGIN;
  if (!origin || request.headers.get("origin") !== origin) return NextResponse.json({ error: "Refresh this page and try again." }, { status: 403 });
  if (!authEnabled() || !authReady()) return NextResponse.json({ error: "Sign-in is temporarily unavailable." }, { status: 503 });
  const now = Date.now(), ip = request.headers.get("x-real-ip") || "unknown";
  for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
  const state = attempts.get(ip) || { count: 0, until: now + 60_000 };
  if (state.count >= 8 || attempts.size >= 10000) return NextResponse.json({ error: "Too many attempts. Wait a minute and try again." }, { status: 429, headers: { "Retry-After": "60" } });
  state.count++; attempts.set(ip, state);
  if (Number(request.headers.get("content-length")) > 4096) return new NextResponse(null, { status: 413 });
  let form: FormData;
  try { form = await request.formData(); } catch { return NextResponse.json({ error: "Please enter your username and password." }, { status: 400 }); }
  const username = String(form.get("username") || "").trim(), password = String(form.get("password") || "");
  if (username.length > 254 || !await validCredentials(username, password)) return NextResponse.json({ error: "The username or password is incorrect." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const response = NextResponse.json({ next: safeDestination(String(form.get("next") || "")) }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(SESSION_COOKIE, issueSession(), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: SESSION_SECONDS });
  return response;
}
