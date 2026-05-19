import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import type { Debrief } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  const interview = await prisma.interview.findFirst({
    where: { id: params.id, userId: user.id },
    select: {
      id: true,
      problemId: true,
      language: true,
      code: true,
      totalScore: true,
      recommendation: true,
      status: true,
      startedAt: true,
      completedAt: true,
      approachAcceptedAt: true,
      movedToCodeEarly: true,
      problem: {
        select: { title: true, difficulty: true, topic: true, leetcodeUrl: true },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        select: { phase: true, role: true, content: true, createdAt: true },
      },
      debrief: { select: { payload: true } },
    },
  });

  if (!interview) return Response.json({ error: "Not found" }, { status: 404 });

  return Response.json({
    interview: {
      ...interview,
      debrief: (interview.debrief?.payload as unknown as Debrief) ?? null,
    },
  });
}
