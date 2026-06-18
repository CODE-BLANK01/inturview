import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import type { ConversationDebrief } from "@/lib/conversationTypes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  const session = await prisma.conversationSession.findFirst({
    where: { id: params.id, userId: user.id },
    select: {
      id: true,
      kind: true,
      scenarioId: true,
      status: true,
      totalScore: true,
      recommendation: true,
      startedAt: true,
      completedAt: true,
      scenario: { select: { title: true, category: true, prompt: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        select: { role: true, content: true, createdAt: true },
      },
      debrief: { select: { payload: true } },
    },
  });
  if (!session) return Response.json({ error: "Not found" }, { status: 404 });

  return Response.json({
    session: {
      ...session,
      debrief: (session.debrief?.payload as unknown as ConversationDebrief) ?? null,
    },
  });
}
