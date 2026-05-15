import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await requireUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  const url = new URL(req.url);
  const problemId = url.searchParams.get("problem_id");

  const rows = await prisma.interview.findMany({
    where: {
      userId: user.id,
      ...(problemId ? { problemId } : {}),
      status: "COMPLETED",
    },
    orderBy: { completedAt: "desc" },
    take: 100,
    select: {
      id: true,
      problemId: true,
      totalScore: true,
      recommendation: true,
      completedAt: true,
      startedAt: true,
      problem: { select: { title: true, difficulty: true, topic: true } },
    },
  });

  return Response.json({ interviews: rows });
}
