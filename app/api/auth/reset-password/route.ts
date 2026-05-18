import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { validateResetToken, markTokenUsed } from "@/lib/passwordReset";
import { checkRateLimit, clientKey, pruneExpired } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  token: z.string().min(20).max(200),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password is too long"),
});

export async function POST(req: NextRequest) {
  pruneExpired();

  // Light per-IP limit to prevent token bruteforcing. Wide enough to allow
  // typo retries.
  const key = clientKey(req.headers);
  const limit = Number(process.env.RL_RESET_PASSWORD_PER_HOUR ?? 20);
  const rl = checkRateLimit({
    key: `reset:${key}`,
    limit,
    windowMs: 60 * 60_000,
  });
  if (!rl.ok) {
    return Response.json(
      { error: "Too many attempts. Try again in a bit." },
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

  const result = await validateResetToken(parsed.token);
  if (!result.ok) {
    const msg =
      result.reason === "expired"
        ? "This reset link has expired. Request a new one."
        : result.reason === "consumed"
        ? "This reset link has already been used. Request a new one."
        : "This reset link is invalid. Request a new one.";
    return Response.json({ error: msg }, { status: 400 });
  }

  // Refuse to reset for a disabled account.
  const user = await prisma.user.findUnique({
    where: { id: result.userId },
    select: { id: true, disabledAt: true },
  });
  if (!user || user.disabledAt) {
    return Response.json(
      { error: "This account can't be reset. Contact support." },
      { status: 403 }
    );
  }

  const passwordHash = await bcrypt.hash(parsed.password, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    }),
    // Burn the used token AND any other live tokens for this user — single
    // password change invalidates every outstanding reset link.
    prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    }),
  ]);

  // Defensive: ensure the specific token is marked even if the bulk update
  // above didn't catch it for some race reason.
  await markTokenUsed(result.tokenId).catch(() => {});

  return Response.json({ ok: true });
}
