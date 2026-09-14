import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { verifyServiceSecret } from "@/lib/faceToFaceToken";
import { faceToFaceInterviewerInstructions } from "@/lib/faceToFacePrompts";
import type { FaceToFacePlan } from "@/lib/faceToFaceQuestions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Called by the realtime service (server-to-server) to build the session. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!verifyServiceSecret(req.headers.get("x-service-secret"))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const session = await prisma.conversationSession.findFirst({
    where: { id: params.id, kind: "FACE_TO_FACE" },
    select: {
      id: true,
      userId: true,
      status: true,
      startedAt: true,
      plan: true,
      messages: {
        orderBy: { createdAt: "asc" },
        select: { role: true, content: true },
      },
    },
  });
  if (!session || !session.plan) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  const plan = session.plan as unknown as FaceToFacePlan;
  const expiresAt = session.startedAt.getTime() + plan.maxDurationSec * 1000;
  if (session.status === "IN_PROGRESS" && Date.now() > expiresAt) {
    return Response.json({ error: "Session time is up" }, { status: 409 });
  }

  const prior = session.messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  return Response.json({
    id: session.id,
    userId: session.userId,
    status: session.status,
    startedAt: session.startedAt,
    expiresAt: new Date(expiresAt),
    plan,
    instructions: faceToFaceInterviewerInstructions(plan, prior),
    priorTurns: prior.length,
  });
}
