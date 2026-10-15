import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { checkRateLimit, clientKey } from "@/lib/rateLimit";
import { LoopAccessError, loadLoopContext } from "@/lib/loopRuns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ token: z.string().min(20).max(100), roundRunId: z.string().min(1), draft: z.string().max(6000) });

/** Saves the candidate's unsent answer as they type, so a refresh or a crash doesn't lose it. */
export async function POST(req: NextRequest) {
  const rl = checkRateLimit({ key: `loop-draft:${clientKey(req.headers)}`, limit: 120, windowMs: 60_000 });
  if (!rl.ok) return Response.json({ error: "Too many saves" }, { status: 429 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid draft" }, { status: 400 });
  try {
    const ctx = await loadLoopContext(parsed.data.token);
    const r = await prisma.loopRoundRun.updateMany({
      where: { id: parsed.data.roundRunId, run: { inviteId: ctx.invite.id }, status: "IN_PROGRESS" },
      data: { draft: parsed.data.draft || null, draftSavedAt: new Date() },
    });
    return r.count ? Response.json({ ok: true }) : Response.json({ error: "This round is finished." }, { status: 409 });
  } catch (e) {
    if (e instanceof LoopAccessError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
