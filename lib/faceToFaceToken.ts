import { createHmac, timingSafeEqual } from "crypto";

/**
 * Short-lived HS256 JWT that lets the browser prove to the realtime service
 * which session it's allowed to drive. Verified in Python with PyJWT using
 * the same REALTIME_SERVICE_SECRET.
 */

export interface RealtimeTokenClaims {
  sid: string;
  uid: string;
  iat: number;
  exp: number;
}

function secret(): string {
  const s = process.env.REALTIME_SERVICE_SECRET;
  if (!s || s.length < 32) {
    throw new Error("REALTIME_SERVICE_SECRET is not set (min 32 chars).");
  }
  return s;
}

export function isRealtimeConfigured(): boolean {
  try {
    secret();
    return true;
  } catch {
    return false;
  }
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

export function signRealtimeToken(sid: string, uid: string, ttlSec = 15 * 60): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({ sid, uid, iat: now, exp: now + ttlSec } satisfies RealtimeTokenClaims)
  );
  const sig = createHmac("sha256", secret()).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}

export function verifyServiceSecret(headerValue: string | null): boolean {
  if (!headerValue) return false;
  const expected = Buffer.from(secret());
  const given = Buffer.from(headerValue);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
