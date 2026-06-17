import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ session_id: z.string().min(1) });

/**
 * Candidate clicked "Start designing anyway" before the interviewer accepted
 * scope. Stamps movedToDesignEarly=true so the debrief can cap their scores.
 * Idempotent — safe to call twice. Only flips the flag if scopeAcceptedAt is
 * still null (we don't want to penalize a candidate who later got [SCOPED]).
 */
export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await req.json());
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Invalid input" },
      { status: 400 }
    );
  }

  const result = await prisma.designSession.updateMany({
    where: {
      id: parsed.session_id,
      userId: user.id,
      status: "IN_PROGRESS",
      scopeAcceptedAt: null,
    },
    data: { movedToDesignEarly: true },
  });
  if (result.count === 0) {
    // Either already accepted or session doesn't belong to this user — either
    // way it's a no-op; not an error worth surfacing.
    return Response.json({ ok: true, noop: true });
  }
  return Response.json({ ok: true });
}
