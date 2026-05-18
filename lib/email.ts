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
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!client) client = new Resend(key);
  return client;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  text: string;
  /** Optional HTML body. If omitted, only the text body is sent. */
  html?: string;
}

export async function sendEmail(params: SendEmailParams): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = getClient();
  const from = process.env.RESEND_FROM ?? "inturview <onboarding@resend.dev>";

  if (!r) {
    // Dev fallback — log to server console.
    console.log("\n[email] (dev fallback — RESEND_API_KEY not set)");
    console.log(`  to:      ${params.to}`);
    console.log(`  from:    ${from}`);
    console.log(`  subject: ${params.subject}`);
    console.log(`  body:\n${params.text.split("\n").map((l) => `    ${l}`).join("\n")}\n`);
    return { ok: true };
  }

  try {
    const { error } = await r.emails.send({
      from,
      to: params.to,
      subject: params.subject,
      text: params.text,
      ...(params.html ? { html: params.html } : {}),
    });
    if (error) {
      return { ok: false, error: error.message ?? "Resend error" };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Email send failed" };
  }
}

export function appUrl(): string {
  return process.env.NEXTAUTH_URL ?? "http://localhost:3000";
}
