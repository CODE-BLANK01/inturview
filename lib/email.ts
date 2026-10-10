import { Resend } from "resend";

/**
 * Email sender with a dev fallback. In production, set RESEND_API_KEY and
 * RESEND_FROM. In dev, leave them unset — emails get logged to the server
 * console so you can copy/paste the reset link without configuring an inbox.
 *
 *   RESEND_API_KEY   The Resend API key (https://resend.com/api-keys)
 *   RESEND_FROM      The "from" address. For dev/testing without a verified
 *                    domain, use the Resend onboarding address:
 *                    "inturview <onboarding@resend.dev>"
 */

let client: Resend | null = null;

function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  if (!client) client = new Resend(key);
  return client;
}

export function emailConfigurationError(): string | null {
  if (!process.env.RESEND_API_KEY?.trim()) return "RESEND_API_KEY is missing";
  if (!process.env.RESEND_FROM?.trim()) return "RESEND_FROM is missing";
  return null;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  text: string;
  /** Optional HTML body. If omitted, only the text body is sent. */
  html?: string;
  replyTo?: string;
}

export async function sendEmail(
  params: SendEmailParams,
): Promise<{ ok: true; messageId?: string } | { ok: false; error: string }> {
  // A production reset/verification email must never silently become a console log.
  if (process.env.NODE_ENV === "production") {
    const error = emailConfigurationError();
    if (error) return { ok: false, error };
  }
  const r = getClient();
  const from =
    process.env.RESEND_FROM?.trim() || "inturview <onboarding@resend.dev>";

  if (!r) {
    // Dev fallback — log to server console.
    console.log("\n[email] (dev fallback — RESEND_API_KEY not set)");
    console.log(`  to:      ${params.to}`);
    console.log(`  from:    ${from}`);
    console.log(`  subject: ${params.subject}`);
    console.log(
      `  body:\n${params.text
        .split("\n")
        .map((l) => `    ${l}`)
        .join("\n")}\n`,
    );
    return { ok: true };
  }

  try {
    const { data, error } = await r.emails.send({
      from,
      to: params.to,
      subject: params.subject,
      text: params.text,
      ...(params.replyTo ? { replyTo: params.replyTo } : {}),
      ...(params.html ? { html: params.html } : {}),
    });
    if (error) {
      return { ok: false, error: error.message ?? "Resend error" };
    }
    if (!data?.id)
      return {
        ok: false,
        error: "Email provider did not acknowledge the message",
      };
    return { ok: true, messageId: data.id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Email send failed",
    };
  }
}

export function appUrl(): string {
  const configured = process.env.NEXTAUTH_URL?.trim();
  if (!configured && process.env.NODE_ENV === "production") {
    throw new Error("NEXTAUTH_URL is missing");
  }
  const url = new URL(configured || "http://localhost:3000");
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  ) {
    throw new Error("NEXTAUTH_URL must be a valid application URL");
  }
  if (
    process.env.NODE_ENV === "production" &&
    (url.protocol !== "https:" ||
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
  ) {
    throw new Error(
      "NEXTAUTH_URL must be the public HTTPS domain in production",
    );
  }
  return url.origin;
}
