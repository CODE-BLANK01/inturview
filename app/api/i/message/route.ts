import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { cachedInterviewPrompt, getAnthropic, MODEL } from "@/lib/anthropic";
import { trackClaudeUsage, type ClaudeUsage } from "@/lib/aiCost";
import { checkRateLimit, clientKey } from "@/lib/rateLimit";
import { applicantDistinctId, CATEGORY_TO_ANALYTICS, LoopAccessError, loadLoopContext } from "@/lib/loopRuns";
import { COMPLETE_MARKER, interviewerSystemPrompt, MAX_CANDIDATE_TURNS, splitMarker, type FrozenQuestion } from "@/lib/loopRunEngine";
import { toTurns } from "@/lib/loopRoundTurns";
import { CLIENT_TURN_ID, historyThrough, recordAnswer, replyTo, saveReply } from "@/lib/roundAnswers";
import { interviewerTimeNote, roundClock } from "@/lib/roundTiming";
import { finishRound } from "@/lib/scoring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({
  token: z.string().min(20).max(100),
  roundRunId: z.string().min(1),
  /** Made by the browser once per answer; a retry sends the same one. */
  clientTurnId: z.string().regex(CLIENT_TURN_ID),
  content: z.string().trim().min(1, "Write an answer first.").max(6000, "That answer is too long. Split it into two messages."),
});

const NDJSON = { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" };

/**
 * Saves the candidate's answer (once per clientTurnId) and streams the
 * interviewer's reply as newline-delimited JSON: {"t": text} chunks, then
 * {"done": true, "complete": bool}. A retry of an answer whose reply was
 * already saved gets that reply back without another model call.
 */
export async function POST(req: NextRequest) {
  const rl = checkRateLimit({ key: `loop-msg:${clientKey(req.headers)}`, limit: 40, windowMs: 60_000 });
  if (!rl.ok) return Response.json({ error: "You're sending messages very fast. Wait a moment." }, { status: 429 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid message" }, { status: 400 });

  let ctx;
  try {
    ctx = await loadLoopContext(parsed.data.token);
  } catch (e) {
    if (e instanceof LoopAccessError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const rr = await prisma.loopRoundRun.findFirst({
    where: { id: parsed.data.roundRunId, run: { inviteId: ctx.invite.id } },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!rr) return Response.json({ error: "Round not found" }, { status: 404 });
  const round = ctx.loop.rounds[rr.roundIndex]!;
  const { clientTurnId, content } = parsed.data;

  // Already answered and replied to: replay the stored reply (a retry after a dropped connection).
  const prior = rr.messages.find((m) => m.clientTurnId === clientTurnId);
  const priorReply = prior && rr.messages.find((m) => m.replyToId === prior.id);
  if (priorReply) {
    return new Response(`${JSON.stringify({ t: priorReply.content })}\n${JSON.stringify({ done: true, complete: priorReply.endsRound })}\n`, { headers: NDJSON });
  }
  if (rr.status !== "IN_PROGRESS") return Response.json({ error: "This round is finished.", ended: true }, { status: 409 });
  const clock = roundClock(rr.startedAt, round.durationMinutes, rr.deadlineAt);
  if (clock.pastDeadline) {
    await finishRound(rr.id);
    return Response.json({ error: "Time's up for this round. Everything you sent before now is saved.", ended: true }, { status: 409 });
  }
  if (!prior && rr.messages.filter((m) => m.role === "candidate").length >= MAX_CANDIDATE_TURNS) {
    return Response.json({ error: "This round has reached its length limit. Finish the round to continue.", limit: true }, { status: 409 });
  }

  const { answer } = await recordAnswer(rr.id, clientTurnId, content);
  // A reply may have been saved by a concurrent retry since we loaded the round.
  const raced = await replyTo(answer.id);
  if (raced) return new Response(`${JSON.stringify({ t: raced.content })}\n${JSON.stringify({ done: true, complete: raced.endsRound })}\n`, { headers: NDJSON });
  const system = interviewerSystemPrompt({
    loopName: ctx.loop.name, roleTarget: ctx.loop.roleTarget, level: ctx.loop.level, roundTitle: round.title,
    category: round.category, durationMinutes: round.durationMinutes, candidateName: ctx.invite.name,
    questions: rr.questions as unknown as FrozenQuestion[],
  });
  const all = rr.messages.some((m) => m.id === answer.id) ? rr.messages : [...rr.messages, answer];
  const history = historyThrough(all, answer.id);
  const note = interviewerTimeNote(clock);
  const turns = toTurns(note ? [...history, { role: "candidate", content: note }] : history);
  const distinctId = applicantDistinctId(ctx.invite.id);

  const enc = new TextEncoder();
  const abort = new AbortController();
  req.signal.addEventListener("abort", () => abort.abort());
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(enc.encode(`${JSON.stringify(obj)}\n`));
      let full = "";
      let emitted = 0;
      // Hold back enough characters that the end marker is never shown, even half-streamed.
      const HOLD = COMPLETE_MARKER.length + 2;
      try {
        const upstream = await getAnthropic().beta.promptCaching.messages.stream(
          { model: MODEL, max_tokens: 500, ...cachedInterviewPrompt(system, turns) },
          { signal: abort.signal },
        );
        for await (const event of upstream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            full += event.delta.text;
            const safe = full.length - HOLD;
            if (safe > emitted) {
              send({ t: full.slice(emitted, safe) });
              emitted = safe;
            }
          }
        }
        const final = await upstream.finalMessage();
        const { text, complete } = splitMarker(full);
        if (text.length > emitted) send({ t: text.slice(emitted) });
        await saveReply(rr.id, answer.id, text, complete);
        await trackClaudeUsage(distinctId, { category: CATEGORY_TO_ANALYTICS[rr.category], sessionId: rr.id, model: MODEL, purpose: "interview_turn", usage: final.usage as ClaudeUsage, organizationId: ctx.invite.campaign.organizationId });
        send({ done: true, complete });
      } catch (e) {
        if (!abort.signal.aborted) {
          console.error("[i/message] stream failed:", e instanceof Error ? e.message : e);
          send({ error: "The interviewer didn't respond. Send your answer again." });
        }
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: NDJSON });
}
