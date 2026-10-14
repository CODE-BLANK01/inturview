import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getAnthropic, MODEL } from "@/lib/anthropic";
import { trackClaudeUsage, type ClaudeUsage } from "@/lib/aiCost";
import { checkRateLimit, clientKey } from "@/lib/rateLimit";
import { applicantDistinctId, CATEGORY_TO_ANALYTICS, LoopAccessError, loadLoopContext, startRound } from "@/lib/loopRuns";
import { interviewerSystemPrompt, splitMarker, type FrozenQuestion } from "@/lib/loopRunEngine";
import { JOIN_TURN } from "@/lib/loopRoundTurns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ token: z.string().min(20).max(100), roundIndex: z.number().int().min(0).max(20) });

/** Starts or resumes a round and returns its messages, creating the interviewer's opening line. */
export async function POST(req: NextRequest) {
  const rl = checkRateLimit({ key: `loop-round:${clientKey(req.headers)}`, limit: 60, windowMs: 10 * 60_000 });
  if (!rl.ok) return Response.json({ error: "Too many requests. Wait a minute." }, { status: 429 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  try {
    const ctx = await loadLoopContext(parsed.data.token);
    const { roundRun: rr, created } = await startRound(ctx, parsed.data.roundIndex);
    let messages = await prisma.loopMessage.findMany({ where: { roundRunId: rr.id }, orderBy: { createdAt: "asc" }, select: { id: true, role: true, content: true } });
    // Only the request that created the round writes the opening, so a double
    // start can't produce two greetings. A round left without one (the first
    // call failed) gets it on a later visit.
    const stuck = messages.length === 0 && Date.now() - rr.startedAt.getTime() > 30_000;
    if (messages.length === 0 && rr.status === "IN_PROGRESS" && (created || stuck)) {
      const round = ctx.loop.rounds[parsed.data.roundIndex]!;
      const system = interviewerSystemPrompt({
        loopName: ctx.loop.name, roleTarget: ctx.loop.roleTarget, level: ctx.loop.level, roundTitle: round.title,
        category: round.category, durationMinutes: round.durationMinutes, candidateName: ctx.invite.name,
        questions: rr.questions as unknown as FrozenQuestion[],
      });
      const resp = await getAnthropic().messages.create({ model: MODEL, max_tokens: 400, system, messages: [{ role: "user", content: JOIN_TURN }] });
      await trackClaudeUsage(applicantDistinctId(ctx.invite.id), { category: CATEGORY_TO_ANALYTICS[rr.category], sessionId: rr.id, model: MODEL, purpose: "interview_turn", usage: resp.usage as ClaudeUsage, organizationId: ctx.invite.campaign.organizationId });
      const opening = splitMarker(resp.content.map((b) => (b.type === "text" ? b.text : "")).join("")).text;
      await prisma.loopMessage.create({ data: { roundRunId: rr.id, role: "interviewer", content: opening } });
      messages = await prisma.loopMessage.findMany({ where: { roundRunId: rr.id }, orderBy: { createdAt: "asc" }, select: { id: true, role: true, content: true } });
    }
    // The losing request of a double start returns before the opening exists;
    // the page asks again shortly.
    return Response.json({ roundRunId: rr.id, status: rr.status, messages, pending: messages.length === 0 && rr.status === "IN_PROGRESS" });
  } catch (e) {
    if (e instanceof LoopAccessError) return Response.json({ error: e.message }, { status: e.status });
    console.error("[i/round]", e instanceof Error ? e.message : e);
    return Response.json({ error: "Couldn't start the round. Try again in a moment." }, { status: 502 });
  }
}
