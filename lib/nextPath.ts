/**
 * The page to return to after sign-in, sign-up or email verification.
 * Only same-site paths are accepted, so it can't be used as an open redirect.
 */
export function safeNext(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\") || v.length > 300) return null;
  if (/[\u0000-\u001f]/.test(v) || /^\/+[a-z][a-z0-9+.-]*:/i.test(v)) return null;
  // Never bounce back into the auth pages themselves.
  if (/^\/(signin|signup|verify-email)(\/|\?|$)/.test(v)) return null;
  return v;
}
