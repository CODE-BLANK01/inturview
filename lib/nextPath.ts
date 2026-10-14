/**
 * The page to return to after sign-in, sign-up or email verification.
 * Only same-site paths are accepted, so it can't be used as an open redirect.
 */
export function safeNext(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\") || v.length > 300) return null;
  if (/[\u0000-\u001f]/.test(v) || /^\/+[a-z][a-z0-9+.-]*:/i.test(v)) return null;
  // Never bounce back into sign-in or sign-up. (/verify-email?token=… is a
  // legitimate place to return to after signing in from the email link.)
  if (/^\/(signin|signup)(\/|\?|$)/.test(v)) return null;
  return v;
}

/** Where to go once the email is verified: anywhere safeNext allows except verification itself. */
export function afterVerify(value: unknown): string | null {
  const v = safeNext(value);
  return v && !/^\/verify-email(\/|\?|$)/.test(v) ? v : null;
}
