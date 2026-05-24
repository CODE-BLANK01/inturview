import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createResetToken } from "@/lib/passwordReset";
import { sendEmail, appUrl } from "@/lib/email";
import { checkRateLimit, clientKey, pruneExpired } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ email: z.string().email().max(200) });

/**
 * Generic-success endpoint: ALWAYS returns 200 with the same response shape
 * regardless of whether the email matches an account. This prevents account
 * enumeration via the forgot-password form.
 *
 * Disabled accounts (`disabledAt !== null`) are skipped silently — same
 * generic response, no email sent.
 */
export async function POST(req: NextRequest) {
  pruneExpired();

  // Tight rate limit — email is the abuse vector here, not the rate-limited
  // signin form. Per-IP cap prevents email bombing across different inboxes.
  const key = clientKey(req.headers);
  const limit = Number(process.env.RL_FORGOT_PASSWORD_PER_HOUR ?? 5);
  const rl = checkRateLimit({ key: `forgot:${key}`, limit, windowMs: 60 * 60_000 });
  if (!rl.ok) {
    return Response.json(
      { ok: true }, // still generic — don't tell attackers they hit the limit
      { status: 200 }
    );
  }

  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    // Even bad input gets the generic response.
    return Response.json({ ok: true });
  }

  const email = parsed.email.toLowerCase().trim();

  // Per-destination-email cap, independent of IP. The per-IP limit above only
  // protects against ONE host bombing many inboxes; the real attack is a
  // proxy pool ALL targeting one inbox to drown the user in reset emails.
  // This bucket is shared across every source IP for the same target — so the
  // victim's address can receive at most N reset emails an hour total, no
  // matter how many hosts the attacker controls.
  const targetRl = checkRateLimit({
    key: `forgot-target:${email}`,
    limit: Number(process.env.RL_FORGOT_TARGET_PER_HOUR ?? 3),
    windowMs: 60 * 60_000,
  });
  if (!targetRl.ok) {
    // Same generic 200 — the rate limit must not double as an enumeration oracle.
    return Response.json({ ok: true });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, disabledAt: true },
  });

  // Send only if the account exists AND is enabled.
  if (user && !user.disabledAt) {
    try {
      const { rawToken, expiresAt } = await createResetToken(user.id);
      const resetUrl = `${appUrl()}/reset-password?token=${encodeURIComponent(rawToken)}`;
      const first = user.name?.split(/\s+/)[0]?.trim();

      await sendEmail({
        to: user.email,
        subject: "Reset your inturview account password",
        text: [
          `Hi${first ? ` ${first}` : ""},`,
          "",
          "You (or someone using your email) asked to reset your inturview password.",
          "Click the link below to set a new one. It expires in 1 hour.",
          "",
          resetUrl,
          "",
          "If you didn't request this, ignore this email — your password stays the same.",
          "",
          "— inturview",
        ].join("\n"),
        html: `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#FAF7F2;color:#1A1410;padding:32px;line-height:1.6">
  <p>Hi${first ? ` ${first}` : ""},</p>
  <p>You (or someone using your email) asked to reset your inturview account password.<br>
  Click below to set a new one. The link expires <strong>in 1 hour</strong>.</p>
  <p style="margin:24px 0">
    <a href="${resetUrl}" style="background:#1A1410;color:#FAF7F2;padding:12px 20px;text-decoration:none;border-radius:8px;font-weight:600;display:inline-block">Reset password</a>
  </p>
  <p style="font-size:13px;color:#6B5E54">Or copy this link into your browser:<br><code style="word-break:break-all;font-size:12px">${resetUrl}</code></p>
  <hr style="border:none;border-top:1px solid #E8E2D9;margin:32px 0">
  <p style="font-size:13px;color:#6B5E54">If you didn't request this, ignore this email — your password stays the same.</p>
  <p style="font-size:13px;color:#6B5E54">— inturview</p>
</body></html>`,
      });
      // Token expiry is informational for logs; don't return it to the client.
      void expiresAt;
    } catch (err) {
      // Swallow — never reveal failure mode to the client. Log for ops.
      console.error("[forgot-password] send failed:", err instanceof Error ? err.message : err);
    }
  }

  return Response.json({ ok: true });
}
