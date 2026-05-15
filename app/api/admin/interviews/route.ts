import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const status = url.searchParams.get("status") as
    | "IN_PROGRESS"
    | "COMPLETED"
    | "ABANDONED"
    | null;
  const userId = url.searchParams.get("userId");
  const problemId = url.searchParams.get("problemId");

  const interviews = await prisma.interview.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(userId ? { userId } : {}),
      ...(problemId ? { problemId } : {}),
    },
    orderBy: { startedAt: "desc" },
    take: 200,
    select: {
      id: true,
      userId: true,
      problemId: true,
      status: true,
      totalScore: true,
      recommendation: true,
      startedAt: true,
      completedAt: true,
      approachAcceptedAt: true,
      movedToCodeEarly: true,
      user: { select: { email: true, name: true } },
      problem: { select: { title: true, difficulty: true, topic: true } },
    },
  });

  return Response.json({ interviews });
}
