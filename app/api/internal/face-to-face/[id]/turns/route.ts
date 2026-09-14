import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyServiceSecret } from "@/lib/faceToFaceToken";
import type { FaceToFacePlan } from "@/lib/faceToFaceQuestions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Turns may arrive a little after the cap while the interviewer wraps up.
const LATE_TURN_GRACE_MS = 3 * 60 * 1000;

const Body = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(20_000),
  metrics: z.record(z.unknown()).nullable().optional(),
});

/** Called by the realtime service to persist one transcript turn. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!verifyServiceSecret(req.headers.get("x-service-secret"))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
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

  const session = await prisma.conversationSession.findFirst({
    where: { id: params.id, kind: "FACE_TO_FACE" },
    select: { id: true, status: true, startedAt: true, plan: true },
  });
  if (!session) return Response.json({ error: "Session not found" }, { status: 404 });
  if (session.status !== "IN_PROGRESS") {
    return Response.json({ error: "Session is not in progress" }, { status: 409 });
  }
  const plan = session.plan as unknown as FaceToFacePlan | null;
  if (
    plan &&
    Date.now() > session.startedAt.getTime() + plan.maxDurationSec * 1000 + LATE_TURN_GRACE_MS
  ) {
    return Response.json({ error: "Session time is up" }, { status: 409 });
  }

  const message = await prisma.conversationMessage.create({
    data: {
      sessionId: session.id,
      role: parsed.role,
      content: parsed.content,
      metrics: parsed.metrics ? (parsed.metrics as object) : undefined,
    },
    select: { id: true, createdAt: true },
  });

  return Response.json(message, { status: 201 });
}
