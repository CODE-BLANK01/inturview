import Link from "next/link";
import { TopNav } from "@/components/TopNav";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { DifficultyBadge, RecommendationBadge, TopicBadge } from "@/components/Badges";
import type { Difficulty, Debrief } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "History — intervue" };

export default async function HistoryPage() {
  const user = await requireUser();
  if (!user) return null; // middleware redirects, but just in case

  const interviews = await prisma.interview.findMany({
    where: { userId: user.id, status: "COMPLETED" },
    orderBy: { completedAt: "desc" },
    take: 100,
    select: {
      id: true,
      problemId: true,
      totalScore: true,
      recommendation: true,
      completedAt: true,
      problem: { select: { title: true, difficulty: true, topic: true } },
    },
  });

  return (
    <>
      <TopNav />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Your interviews</h1>
          <p className="mt-1 text-text-muted">
            Every completed mock interview, with transcript, code, and the scorecard.
          </p>
        </header>

        {interviews.length === 0 ? (
          <div className="panel p-10 text-center text-text-muted">
            No completed interviews yet.{" "}
            <Link href="/problems" className="text-accent hover:underline">
              Pick a problem
            </Link>{" "}
            and run one.
          </div>
        ) : (
          <div className="panel divide-y divide-border overflow-hidden">
            {interviews.map((iv) => (
              <Link
                key={iv.id}
                href={`/history/${iv.id}`}
                className="flex items-center gap-3 p-4 hover:bg-bg-surface transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{iv.problem.title}</span>
                    <DifficultyBadge value={iv.problem.difficulty as Difficulty} />
                    <TopicBadge value={iv.problem.topic} />
                  </div>
                  <div className="text-xs text-text-dim mt-0.5">
                    {iv.completedAt ? new Date(iv.completedAt).toLocaleString() : ""}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm tabular-nums">
                    {iv.totalScore ?? "—"}
                    <span className="text-text-dim">/25</span>
                  </div>
                  {iv.recommendation && (
                    <div className="mt-1">
                      <RecommendationBadge
                        value={iv.recommendation as Debrief["overall_recommendation"]}
                      />
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
