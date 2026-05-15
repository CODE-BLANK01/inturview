type Bucket = { tokens: number; refillAt: number };

const buckets = new Map<string, Bucket>();

export interface RateLimitOptions {
  key: string;
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetMs: number;
}

export function checkRateLimit({ key, limit, windowMs }: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.refillAt <= now) {
    buckets.set(key, { tokens: limit - 1, refillAt: now + windowMs });
    return { ok: true, remaining: limit - 1, resetMs: windowMs };
  }
  if (existing.tokens <= 0) {
    return { ok: false, remaining: 0, resetMs: existing.refillAt - now };
  }
  existing.tokens -= 1;
  return { ok: true, remaining: existing.tokens, resetMs: existing.refillAt - now };
}

// Periodically prune to keep the map small under load.
const PRUNE_EVERY = 5 * 60_000;
let lastPrune = Date.now();
export function pruneExpired() {
  const now = Date.now();
  if (now - lastPrune < PRUNE_EVERY) return;
  lastPrune = now;
  for (const [k, b] of buckets) {
    if (b.refillAt <= now) buckets.delete(k);
  }
}

export function clientKey(headers: Headers, fallback = "anon"): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  return fallback;
}
