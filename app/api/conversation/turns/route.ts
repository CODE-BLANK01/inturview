import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { checkRateLimit, clientKey, pruneExpired } from "@/lib/rateLimit";
import { isUsableTranscript } from "@/lib/realtimeClient";
import { turnMetrics } from "@/lib/speechMetrics";
import { LATE_TURN_GRACE_MS, readVoicePlan, voiceDeadlineMs } from "@/lib/voicePlan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Segment = z.object({ start: z.number(), end: z.number() });

const Body = z.object({
  session_id: z.string().min(1),
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(8_000),
  /** Candidate turns only: speech timing, for delivery metrics. */
  segments: z.array(Segment).max(200).optional(),
});

/**
 * Saves one transcript turn of a spoken recruiter screen or behavioral
 * session. The browser sends both sides as they finish; delivery metrics are
 * computed here, so the debrief never trusts numbers the client made up.
 */
export async function POST(req: NextRequest) {
  pruneExpired();
  const user = await requireUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  const rl = checkRateLimit({
    key: `cturn:${user.id}:${clientKey(req.headers)}`,
    limit: Number(process.env.RL_VOICE_TURNS_PER_MIN ?? 60),
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return Response.json(
      { error: "Rate limit exceeded." },
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
    select: { id: true, status: true, plan: true },
  });
  if (!session) return Response.json({ error: "Session not found" }, { status: 404 });
  if (session.status !== "IN_PROGRESS") {
    return Response.json({ error: "Session is not in progress" }, { status: 409 });
  }
  const plan = readVoicePlan(session.plan);
  if (!plan) return Response.json({ error: "Not a voice session" }, { status: 409 });
  if (Date.now() > voiceDeadlineMs(plan) + LATE_TURN_GRACE_MS) {
    return Response.json({ error: "Session time is up" }, { status: 409 });
  }

  let metrics: object | undefined;
  if (parsed.role === "user") {
    // Backstop for the browser's junk filter: noise transcripts never become turns.
    if (!isUsableTranscript(parsed.content)) {
      return Response.json({ skipped: true }, { status: 200 });
    }
    // Only trust timing that is ordered and spans less than the whole session.
    const segments = (parsed.segments ?? []).filter(
      (s) => s.end >= s.start && s.end - s.start <= plan.maxDurationSec * 1000
    );
    const duration = segments.length
      ? Math.max(...segments.map((s) => s.end)) - Math.min(...segments.map((s) => s.start))
      : null;
    metrics = { ...turnMetrics(parsed.content, duration, segments.length ? segments : null) };
  }

  const message = await prisma.conversationMessage.create({
    data: { sessionId: session.id, role: parsed.role, content: parsed.content, metrics },
    select: { id: true },
  });
  return Response.json(message, { status: 201 });
}
