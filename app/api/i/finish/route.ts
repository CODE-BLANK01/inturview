import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { checkRateLimit, clientKey } from "@/lib/rateLimit";
import { finishRound, LoopAccessError, loadLoopContext } from "@/lib/loopRuns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Ends a round (interviewer finished, or the candidate chose to stop) and scores it. */
export async function POST(req: NextRequest) {
  const rl = checkRateLimit({ key: `loop-finish:${clientKey(req.headers)}`, limit: 20, windowMs: 10 * 60_000 });
  if (!rl.ok) return Response.json({ error: "Too many requests. Wait a minute." }, { status: 429 });
  const parsed = z.object({ token: z.string().min(20).max(100), roundRunId: z.string().min(1) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  try {
    const ctx = await loadLoopContext(parsed.data.token);
    const owned = await prisma.loopRoundRun.count({ where: { id: parsed.data.roundRunId, run: { inviteId: ctx.invite.id } } });
    if (!owned) return Response.json({ error: "Round not found" }, { status: 404 });
    const rr = await finishRound(parsed.data.roundRunId, ctx.invite.userId ?? ctx.invite.id);
    // The candidate never sees scores; only whether they can move on.
    return Response.json({ status: rr.status });
  } catch (e) {
    if (e instanceof LoopAccessError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
