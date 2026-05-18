import { randomBytes, createHash } from "crypto";
import { prisma } from "./db";
import { sendEmail, appUrl } from "./email";

const TOKEN_TTL_MS = 24 * 60 * 60_000; // 24 hours

function generateToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Issues a fresh verification token, burning any prior unused tokens for the
 *  same user. Returns the raw token (for the email link). */
export async function createVerificationToken(userId: string): Promise<{
  rawToken: string;
  expiresAt: Date;
}> {
  const { raw, hash } = generateToken();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await prisma.$transaction([
    prisma.emailVerificationToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.emailVerificationToken.create({
      data: { userId, tokenHash: hash, expiresAt },
    }),
  ]);

  return { rawToken: raw, expiresAt };
}

export interface VerificationTokenValid {
  ok: true;
  userId: string;
  tokenId: string;
}
export interface VerificationTokenInvalid {
  ok: false;
  reason: "missing" | "expired" | "consumed" | "unknown";
}

export async function validateVerificationToken(
  rawToken: string
): Promise<VerificationTokenValid | VerificationTokenInvalid> {
  if (!rawToken || typeof rawToken !== "string") return { ok: false, reason: "missing" };
  const hash = hashToken(rawToken);
  const row = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash: hash },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });
  if (!row) return { ok: false, reason: "unknown" };
  if (row.usedAt) return { ok: false, reason: "consumed" };
  if (row.expiresAt.getTime() < Date.now()) return { ok: false, reason: "expired" };
  return { ok: true, userId: row.userId, tokenId: row.id };
}

/** Atomic consume: in one transaction, mark token used AND set the user's
 *  emailVerifiedAt. Idempotent — re-running for an already-verified user
 *  is a no-op on the user row. */
export async function consumeVerificationToken(opts: {
  tokenId: string;
  userId: string;
}): Promise<void> {
  await prisma.$transaction([
    prisma.emailVerificationToken.update({
      where: { id: opts.tokenId },
      data: { usedAt: new Date() },
    }),
    prisma.user.updateMany({
      where: { id: opts.userId, emailVerifiedAt: null },
      data: { emailVerifiedAt: new Date() },
    }),
  ]);
}

/** Renders + sends the verification email. Pulled out of the signup route so
 *  the resend endpoint can reuse it. */
export async function sendVerificationEmail(opts: {
  toEmail: string;
  toName: string | null;
  rawToken: string;
}): Promise<void> {
  const verifyUrl = `${appUrl()}/verify-email?token=${encodeURIComponent(opts.rawToken)}`;
  const first = opts.toName?.split(/\s+/)[0]?.trim();

  await sendEmail({
    to: opts.toEmail,
    subject: "Verify your inturview email",
    text: [
      `Hi${first ? ` ${first}` : ""},`,
      "",
      "Welcome to inturview. Click the link below to verify your email so we know we can reach you. The link expires in 24 hours.",
      "",
      verifyUrl,
      "",
      "If you didn't sign up for inturview, you can ignore this — the account stays inactive without verification.",
      "",
      "— inturview",
    ].join("\n"),
    html: `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#FAF7F2;color:#1A1410;padding:32px;line-height:1.6">
  <p>Hi${first ? ` ${first}` : ""},</p>
  <p>Welcome to <strong>inturview</strong>. Click below to verify your email so we know we can reach you. The link expires <strong>in 24 hours</strong>.</p>
  <p style="margin:24px 0">
    <a href="${verifyUrl}" style="background:#1A1410;color:#FAF7F2;padding:12px 20px;text-decoration:none;border-radius:8px;font-weight:600;display:inline-block">Verify email</a>
  </p>
  <p style="font-size:13px;color:#6B5E54">Or copy this link into your browser:<br><code style="word-break:break-all;font-size:12px">${verifyUrl}</code></p>
  <hr style="border:none;border-top:1px solid #E8E2D9;margin:32px 0">
  <p style="font-size:13px;color:#6B5E54">If you didn't sign up for inturview, ignore this email — the account stays inactive without verification.</p>
  <p style="font-size:13px;color:#6B5E54">— inturview</p>
</body></html>`,
  });
}
