import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { checkRateLimit, clientKey, pruneExpired } from "@/lib/rateLimit";
import { getBehavioralScenario } from "@/lib/behavioralScenarios";
import { readVoicePlan, voiceDeadlineMs } from "@/lib/voicePlan";
import { behavioralVoiceBrief, recruiterVoiceBrief, type VoiceBrief } from "@/lib/voiceInterviewer";
import {
  mintRealtimeClientSecret,
  OUTPUT_LANGUAGE_RULE,
  RealtimeMintError,
} from "@/lib/realtimeSession";
import { voiceEnabledFor } from "@/lib/features";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ session_id: z.string().min(1) });

/**
 * Mints a short-lived OpenAI Realtime key for one spoken recruiter screen or
 * behavioral session. The interviewer's instructions are baked into the key
 * server-side, so the browser can't change who it's talking to. Called on
 * every (re)connect.
 */
export async function POST(req: NextRequest) {
  pruneExpired();
  const user = await requireUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  // Each key opens a paid call, so reconnects are tightly limited.
  const rl = checkRateLimit({
    key: `cvkey:${user.id}:${clientKey(req.headers)}`,
    limit: Number(process.env.RL_VOICE_KEY_PER_MIN ?? 5),
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return Response.json(
      { error: "Too many reconnects. Wait a moment and try again." },
      { status: 429, headers: { "retry-after": Math.ceil(rl.resetMs / 1000).toString() } }
    );
  }

  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await req.json());
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Invalid request" },
      { status: 400 }
    );
  }

  const session = await prisma.conversationSession.findFirst({
    where: {
      id: parsed.session_id,
      userId: user.id,
      kind: { in: ["RECRUITER_SCREEN", "BEHAVIORAL"] },
    },
    select: { id: true, kind: true, status: true, scenarioId: true, plan: true },
  });
  if (!session) return Response.json({ error: "Session not found" }, { status: 404 });
  const kind = session.kind as "RECRUITER_SCREEN" | "BEHAVIORAL";
  if (!voiceEnabledFor(kind)) {
    return Response.json({ error: "Voice interviews are turned off" }, { status: 403 });
  }
  if (session.status !== "IN_PROGRESS") {
    return Response.json({ error: "Session is not in progress" }, { status: 409 });
  }
  const plan = readVoicePlan(session.plan);
  if (!plan) return Response.json({ error: "Not a voice session" }, { status: 409 });

  const remainingSec = Math.floor((voiceDeadlineMs(plan) - Date.now()) / 1000);
  if (remainingSec <= 0) {
    return Response.json(
      { error: "Time is up for this session. End it to get your debrief.", code: "TIME_UP" },
      { status: 409 }
    );
  }

  // On a reconnect, the interviewer picks up from the saved transcript.
  const transcript = await prisma.conversationMessage.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: "asc" },
    select: { role: true, content: true },
  });
  let turns = transcript.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));
  // Only the interviewer spoke (the candidate left during the greeting): start
  // over cleanly rather than "welcome back" to a conversation that never began.
  if (turns.length && !turns.some((t) => t.role === "user")) {
    await prisma.conversationMessage.deleteMany({ where: { sessionId: session.id } });
    turns = [];
  }

  let brief: VoiceBrief;
  if (kind === "RECRUITER_SCREEN") {
    brief = recruiterVoiceBrief(turns, plan.maxDurationSec);
  } else {
    const scenario = session.scenarioId ? getBehavioralScenario(session.scenarioId) : null;
    if (!scenario) return Response.json({ error: "Unknown scenario" }, { status: 404 });
    brief = behavioralVoiceBrief(scenario, turns);
  }

  // Checkpoints still ahead are timed by the browser; on a reconnect, the
  // latest one already passed tells the interviewer which section it's in.
  const elapsedSec = plan.maxDurationSec - remainingSec;
  const upcoming = brief.checkpoints
    .filter((c) => c.atSec > elapsedSec)
    .map((c) => ({ in_sec: c.atSec - elapsedSec, note: c.note }));
  const current = brief.checkpoints.filter((c) => c.atSec <= elapsedSec).at(-1);
  const opening =
    OUTPUT_LANGUAGE_RULE +
    brief.openingInstruction +
    (current && turns.length ? `\n\n[${current.note}]` : "");

  try {
    const clientSecret = await mintRealtimeClientSecret({ instructions: brief.instructions });
    return Response.json({
      client_secret: clientSecret,
      // Sent with the first response.create, which replaces the session
      // instructions for that one reply, so it carries the full brief.
      opening_instruction: opening,
      remaining_sec: remainingSec,
      checkpoints: upcoming,
      notes_instruction: brief.notesInstruction,
      transcript: turns,
    });
  } catch (err) {
    const message = err instanceof RealtimeMintError ? err.message : "Couldn't start the voice interviewer.";
    return Response.json({ error: message }, { status: 502 });
  }
}
