import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { checkRateLimit, clientKey, pruneExpired } from "@/lib/rateLimit";
import { readVoicePlan } from "@/lib/voicePlan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  session_id: z.string().min(1),
  notes: z.string().trim().min(1).max(8_000),
});

/**
 * Saves the voice interviewer's end-of-call notes on a spoken session, for the
 * debrief to score with. The browser relays them from OpenAI, the same way it
 * relays every transcript turn, so they get the same trust: the debrief treats
 * them as data and won't credit claims the transcript doesn't support.
 */
export async function POST(req: NextRequest) {
  pruneExpired();
  const user = await requireUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  const rl = checkRateLimit({
    key: `cvnotes:${user.id}:${clientKey(req.headers)}`,
    limit: 5,
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
  // Once scored, the notes are part of the record and can't be swapped.
  if (session.status !== "IN_PROGRESS") {
    return Response.json({ error: "Session is not in progress" }, { status: 409 });
  }
  const plan = readVoicePlan(session.plan);
  if (!plan) return Response.json({ error: "Not a voice session" }, { status: 409 });

  await prisma.conversationSession.update({
    where: { id: session.id },
    data: { plan: { ...plan, interviewerNotes: parsed.notes } as unknown as object },
  });
  return Response.json({ ok: true });
}
