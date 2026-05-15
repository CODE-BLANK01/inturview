import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const user = await requireUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  // Per-problem: latest completed interview score + attempts count.
  const completed = await prisma.interview.findMany({
    where: { userId: user.id, status: "COMPLETED" },
    orderBy: { completedAt: "desc" },
    select: {
      problemId: true,
      totalScore: true,
      recommendation: true,
      completedAt: true,
    },
  });

  const byProblem: Record<
    string,
    { attempts: number; lastScore: number | null; lastRecommendation: string | null; lastAt: string | null }
  > = {};
  for (const row of completed) {
    const entry = byProblem[row.problemId];
    if (!entry) {
      byProblem[row.problemId] = {
        attempts: 1,
        lastScore: row.totalScore,
        lastRecommendation: row.recommendation,
        lastAt: row.completedAt?.toISOString() ?? null,
      };
    } else {
      entry.attempts += 1;
    }
  }

  return Response.json({ stats: byProblem });
}
