import { createHmac, randomBytes, timingSafeEqual, scrypt as deriveKey } from "node:crypto";

export const SESSION_COOKIE = "__Host-racklab-session";
export const SESSION_SECONDS = 12 * 60 * 60;
export const authEnabled = () => process.env.RACKLAB_AUTH_ENABLED === "true";
export function authReady() {
  return !!process.env.RACKLAB_LOGIN_USER && /^[a-f0-9]{32}:[a-f0-9]{128}$/.test(process.env.RACKLAB_PASSWORD_HASH || "") && (process.env.RACKLAB_SESSION_SECRET?.length || 0) >= 64;
}
export function safeDestination(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\r\n]/.test(value) || value.startsWith("/login") || value.startsWith("/api/session")) return "/projects";
  try { const url = new URL(value, "https://local.invalid"); return url.origin === "https://local.invalid" ? url.pathname + url.search : "/projects"; } catch { return "/projects"; }
}
function signature(value: string) { return createHmac("sha256", process.env.RACKLAB_SESSION_SECRET!).update(value).digest("base64url"); }
export function issueSession(now = Date.now()) {
  if (!authReady()) throw new Error("Authentication is not configured");
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(now / 1000) + SESSION_SECONDS, nonce: randomBytes(18).toString("hex") })).toString("base64url");
  return payload + "." + signature(payload);
}
export function validSession(token: string | undefined, now = Date.now()) {
  if (!authReady() || !token || token.length > 1024) return false;
  try {
    const [payload, mac, extra] = token.split(".");
    if (!payload || !mac || extra) return false;
    const expected = Buffer.from(signature(payload)), actual = Buffer.from(mac);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    const current = Math.floor(now / 1000);
    return Number.isInteger(data.exp) && data.exp > current && data.exp <= current + SESSION_SECONDS && typeof data.nonce === "string";
  } catch { return false; }
}
export async function validCredentials(username: string, password: string) {
  if (!authReady() || password.length > 1024) return false;
  const [salt, expected] = process.env.RACKLAB_PASSWORD_HASH!.split(":");
  const actual = await new Promise<Buffer>((resolve, reject) => deriveKey(password, Buffer.from(salt, "hex"), 64, { N: 16384, r: 8, p: 1 }, (error, key) => error ? reject(error) : resolve(key)));
  return timingSafeEqual(actual, Buffer.from(expected, "hex")) && username === process.env.RACKLAB_LOGIN_USER;
}
