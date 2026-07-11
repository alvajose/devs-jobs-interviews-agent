import "server-only";
import crypto from "node:crypto";

// Admin gate: a single shared secret, verified server-side. We store only the SHA-256
// HASH of the secret in the env (ADMIN_SECRET_HASH), never the plaintext. Generate it with:
//   node -e "console.log(require('node:crypto').createHash('sha256').update('YOUR_SECRET').digest('hex'))"
// This is independent of the Supabase user login, it guards /admin on its own.

export const ADMIN_COOKIE = "admin_session";
const SESSION_MAX_AGE = 60 * 60 * 8; // 8 hours

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

/** Constant-time string compare that never throws on length mismatch. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false; // length is not secret; only the value is
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/** True when the submitted secret matches ADMIN_SECRET_HASH. Fails closed if unset. */
export function verifySecret(input: string): boolean {
  const expected = process.env.ADMIN_SECRET_HASH;
  if (!expected) return false;
  return safeEqual(sha256(input), expected);
}

/**
 * Deterministic session value stored in the cookie: an HMAC keyed by the secret hash.
 * The plaintext secret and its hash never reach the client, only this derived token does,
 * and it can't be forged without the server-side key.
 */
function sessionToken(): string {
  const key = process.env.ADMIN_SECRET_HASH ?? "";
  return crypto.createHmac("sha256", key).update("admin-session").digest("hex");
}

export function isValidSession(cookieValue: string | undefined): boolean {
  if (!cookieValue || !process.env.ADMIN_SECRET_HASH) return false;
  return safeEqual(cookieValue, sessionToken());
}

export const sessionCookie = () => ({
  name: ADMIN_COOKIE,
  value: sessionToken(),
  options: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // localhost is http; secure cookies won't set there
    sameSite: "strict" as const,
    path: "/admin",
    maxAge: SESSION_MAX_AGE,
  },
});
