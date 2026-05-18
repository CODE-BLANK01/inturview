import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { checkRateLimit, clientKey, pruneExpired } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  /** User must type the exact confirm phrase to avoid accidental deletes. */
  confirm: z.string(),
  /** Re-prompt password — irreversible action gate. */
  password: z.string().min(1).max(128),
});

const REQUIRED_CONFIRM = "delete my account";

export async function POST(req: NextRequest) {
  pruneExpired();
  const user = await requireUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  // Hard rate limit — three attempts an hour is plenty for a legit user
  // typo'ing the confirm phrase.
  const key = clientKey(req.headers);
  const rl = checkRateLimit({
    key: `delete-account:${user.id}:${key}`,
    limit: 3,
    windowMs: 60 * 60_000,
  });
  if (!rl.ok) {
    return Response.json(
      { error: "Too many attempts. Wait an hour." },
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

  if (parsed.confirm.trim().toLowerCase() !== REQUIRED_CONFIRM) {
    return Response.json(
      { error: `Type "${REQUIRED_CONFIRM}" exactly to confirm.` },
      { status: 400 }
    );
  }

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true, role: true },
  });
  if (!row) return Response.json({ error: "Account not found." }, { status: 404 });

  const ok = await bcrypt.compare(parsed.password, row.passwordHash);
  if (!ok) {
    return Response.json(
      { error: "Password is incorrect." },
      { status: 400 }
    );
  }

  // Refuse to nuke the last admin. Stops you from accidentally locking the
  // platform out of admin access.
  if (row.role === "ADMIN") {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1) {
      return Response.json(
        {
          error:
            "You're the only admin — promote someone else first, then delete this account.",
        },
        { status: 400 }
      );
    }
  }

  // Cascading delete handles Interview → Message → Debrief, plus the
  // PasswordResetToken / EmailVerificationToken relations.
  await prisma.user.delete({ where: { id: user.id } });

  return Response.json({ ok: true });
}
