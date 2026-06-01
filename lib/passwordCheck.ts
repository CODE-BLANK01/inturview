import { createHash } from "crypto";

export const MIN_PASSWORD_LENGTH = 10;

export type PasswordValidationResult =
  | { ok: true; pwnedCheck: "passed" | "skipped" }
  | { ok: false; error: string };

export async function validatePasswordStrength(
  password: string
): Promise<PasswordValidationResult> {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  }

  const sha1 = createHash("sha1").update(password).digest("hex").toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: {
        "user-agent": "inturview-password-check",
        "add-padding": "true",
      },
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return { ok: true, pwnedCheck: "skipped" };

    const body = await res.text();
    const found = body
      .split("\n")
      .some((line) => line.split(":")[0]?.trim().toUpperCase() === suffix);

    if (found) {
      return {
        ok: false,
        error:
          "That password appears in a breach list. Choose a less common password.",
      };
    }
    return { ok: true, pwnedCheck: "passed" };
  } catch {
    // Availability beats strictness here: if HIBP is down or blocked, keep the
    // local length rule and let the user continue.
    return { ok: true, pwnedCheck: "skipped" };
  }
}
