import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { checkRateLimit, clientKey, pruneExpired } from "@/lib/rateLimit";
import { MIN_PASSWORD_LENGTH, validatePasswordStrength } from "@/lib/passwordCheck";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
    .max(128, "Password is too long"),
});

export async function POST(req: NextRequest) {
  pruneExpired();
  const user = await requireUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  // Light per-user limit to discourage online brute-forcing of `currentPassword`.
  const key = clientKey(req.headers);
  const limit = Number(process.env.RL_CHANGE_PASSWORD_PER_HOUR ?? 10);
  const rl = checkRateLimit({
    key: `change-pw:${user.id}:${key}`,
    limit,
    windowMs: 60 * 60_000,
  });
  if (!rl.ok) {
    return Response.json(
      { error: "Too many attempts. Try again later." },
      { status: 429 }
    );
  }

  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await req.json());
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Invalid input" },
      { status: 400 }
    );
  }

  if (parsed.currentPassword === parsed.newPassword) {
    return Response.json(
      { error: "New password must be different from the current one." },
      { status: 400 }
    );
  }

  const strength = await validatePasswordStrength(parsed.newPassword);
  if (!strength.ok) {
    return Response.json({ error: strength.error }, { status: 400 });
  }

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true, disabledAt: true },
  });
  if (!row || row.disabledAt) {
    return Response.json({ error: "Account not available." }, { status: 404 });
  }

  const ok = await bcrypt.compare(parsed.currentPassword, row.passwordHash);
  if (!ok) {
    return Response.json(
      { error: "Current password is incorrect." },
      { status: 400 }
    );
  }

  const newHash = await bcrypt.hash(parsed.newPassword, 12);

  // Update the hash, bump tokenVersion (revokes every outstanding JWT —
  // including the current session), AND burn outstanding reset tokens. A
  // password change should kill any phishing-stage reset link that's been
  // sitting in an attacker's hands.
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newHash,
        tokenVersion: { increment: 1 },
      },
    }),
    prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    }),
  ]);

  // mustSignInAgain tells the client to call signOut() — the current JWT is
  // now inert and the next protected request would 401-redirect anyway.
  return Response.json({ ok: true, mustSignInAgain: true });
}
