import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  createVerificationToken,
  sendVerificationEmail,
} from "@/lib/emailVerification";
import { checkRateLimit, clientKey, pruneExpired } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  pruneExpired();
  const user = await requireUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  // Tighter limit — once a minute is plenty for someone who just clicked
  // "Resend". Stops the form from being used as a relay.
  const key = clientKey(req.headers);
  const limit = Number(process.env.RL_VERIFICATION_PER_HOUR ?? 5);
  const rl = checkRateLimit({
    key: `verify-resend:${user.id}:${key}`,
    limit,
    windowMs: 60 * 60_000,
  });
  if (!rl.ok) {
    return Response.json(
      { error: "Too many requests. Wait a few minutes and try again." },
      { status: 429 }
    );
  }

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: { email: true, name: true, emailVerifiedAt: true, disabledAt: true },
  });
  if (!profile || profile.disabledAt) {
    return Response.json({ error: "Account not found." }, { status: 404 });
  }
  // Already verified — no-op success so the UI can simply show the verified state.
  if (profile.emailVerifiedAt) {
    return Response.json({ ok: true, alreadyVerified: true });
  }

  try {
    const { rawToken } = await createVerificationToken(user.id);
    await sendVerificationEmail({
      toEmail: profile.email,
      toName: profile.name,
      rawToken,
    });
  } catch (err) {
    console.error("[resend-verification] failed:", err instanceof Error ? err.message : err);
    return Response.json({ error: "Could not send right now. Try again shortly." }, { status: 502 });
  }

  return Response.json({ ok: true });
}
