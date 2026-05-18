import { randomBytes, createHash } from "crypto";
import { prisma } from "./db";

const TOKEN_TTL_MS = 60 * 60_000; // 1 hour

/** Generates a 32-byte URL-safe token (raw — for the email link) and its
 *  SHA-256 hash (for DB storage). Never store or log the raw token. */
function generateToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Creates a new reset token for the user and stores its hash in the DB. Any
 * existing unused tokens for the user are invalidated first (one active token
 * per user at a time).
 */
export async function createResetToken(userId: string): Promise<{ rawToken: string; expiresAt: Date }> {
  const { raw, hash } = generateToken();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await prisma.$transaction([
    // Burn any prior unused tokens — most recent ask wins.
    prisma.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.passwordResetToken.create({
      data: { userId, tokenHash: hash, expiresAt },
    }),
  ]);

  return { rawToken: raw, expiresAt };
}

export interface ResetTokenValid {
  ok: true;
  userId: string;
  tokenId: string;
}
export interface ResetTokenInvalid {
  ok: false;
  reason: "missing" | "expired" | "consumed" | "unknown";
}

/** Looks up a token by its raw value (we hash it before lookup). Does not
 *  consume the token — call markTokenUsed() after a successful password write. */
export async function validateResetToken(rawToken: string): Promise<ResetTokenValid | ResetTokenInvalid> {
  if (!rawToken || typeof rawToken !== "string") {
    return { ok: false, reason: "missing" };
  }
  const hash = hashToken(rawToken);
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hash },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });
  if (!row) return { ok: false, reason: "unknown" };
  if (row.usedAt) return { ok: false, reason: "consumed" };
  if (row.expiresAt.getTime() < Date.now()) return { ok: false, reason: "expired" };
  return { ok: true, userId: row.userId, tokenId: row.id };
}

export async function markTokenUsed(tokenId: string): Promise<void> {
  await prisma.passwordResetToken.update({
    where: { id: tokenId },
    data: { usedAt: new Date() },
  });
}
