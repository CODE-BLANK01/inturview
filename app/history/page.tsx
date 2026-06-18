import Link from "next/link";
import { TopNav } from "@/components/TopNav";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { DifficultyBadge, RecommendationBadge, TopicBadge } from "@/components/Badges";
import type { Difficulty, Debrief } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "History — inturview" };

export default async function HistoryPage() {
  const user = await requireUser();
  if (!user) return null;

  // Both COMPLETED (finished + scored) and ABANDONED (ended early, no debrief)
  // are part of the user's history. IN_PROGRESS rows live on the dashboard.
  const [interviewRows, designRows, conversationRows] = await Promise.all([
    prisma.interview.findMany({
      where: { userId: user.id, status: { in: ["COMPLETED", "ABANDONED"] } },
      orderBy: { completedAt: "desc" },
      take: 100,
      select: {
        id: true,
        status: true,
        totalScore: true,
        recommendation: true,
        completedAt: true,
        problem: { select: { title: true, difficulty: true, topic: true } },
      },
    }),
    prisma.designSession.findMany({
      where: { userId: user.id, status: { in: ["COMPLETED", "ABANDONED"] } },
      orderBy: { completedAt: "desc" },
      take: 100,
      select: {
        id: true,
        status: true,
        totalScore: true,
        recommendation: true,
        completedAt: true,
        problem: { select: { title: true, difficulty: true, topic: true } },
      },
    }),
    prisma.conversationSession.findMany({
      where: { userId: user.id, status: { in: ["COMPLETED", "ABANDONED"] } },
      orderBy: { completedAt: "desc" },
      take: 100,
      select: {
        id: true,
        kind: true,
        status: true,
        totalScore: true,
        recommendation: true,
        completedAt: true,
        scenario: { select: { title: true, category: true } },
      },
    }),
  ]);

  type HistoryItem = {
    id: string;
    kind: "coding" | "design" | "behavioral" | "recruiter";
    href: string;
    status: "COMPLETED" | "ABANDONED";
    totalScore: number | null;
    recommendation: string | null;
    completedAt: Date | null;
    title: string;
    difficulty: string | null;
    topic: string;
  };

  const interviews: HistoryItem[] = [
    ...interviewRows.map((iv) => ({
      id: iv.id,
      kind: "coding" as const,
      href: `/history/${iv.id}`,
      status: iv.status as "COMPLETED" | "ABANDONED",
      totalScore: iv.totalScore,
      recommendation: iv.recommendation,
      completedAt: iv.completedAt,
      title: iv.problem.title,
      difficulty: iv.problem.difficulty,
      topic: iv.problem.topic,
    })),
    ...designRows.map((ds) => ({
      id: ds.id,
      kind: "design" as const,
      href: `/history/design/${ds.id}`,
      status: ds.status as "COMPLETED" | "ABANDONED",
      totalScore: ds.totalScore,
      recommendation: ds.recommendation,
      completedAt: ds.completedAt,
      title: ds.problem.title,
      difficulty: ds.problem.difficulty,
      topic: ds.problem.topic,
    })),
    ...conversationRows.map((cs) => ({
      id: cs.id,
      kind: (cs.kind === "BEHAVIORAL" ? "behavioral" : "recruiter") as
        | "behavioral"
        | "recruiter",
      href: `/history/conversation/${cs.id}`,
      status: cs.status as "COMPLETED" | "ABANDONED",
      totalScore: cs.totalScore,
      recommendation: cs.recommendation,
      completedAt: cs.completedAt,
      title:
        cs.kind === "BEHAVIORAL"
          ? cs.scenario?.title ?? "Behavioral"
          : "Recruiter screen",
      difficulty: null,
      topic:
        cs.kind === "BEHAVIORAL"
          ? cs.scenario?.category ?? "Behavioral"
          : "Phone screen",
    })),
  ].sort((a, b) => {
    const at = a.completedAt?.getTime() ?? 0;
    const bt = b.completedAt?.getTime() ?? 0;
    return bt - at;
  });

  const KIND_LABEL: Record<HistoryItem["kind"], string> = {
    coding: "Coding",
    design: "System design",
    behavioral: "Behavioral",
    recruiter: "Recruiter screen",
  };

  return (
    <>
      <TopNav />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Your interviews</h1>
          <p className="mt-1 text-text-muted">
            Every mock interview you&apos;ve taken — completed sessions show the
            scorecard, ended sessions show the transcript and code you wrote.
          </p>
        </header>

        {interviews.length === 0 ? (
          <div className="panel p-10 text-center text-text-muted">
            No interviews yet.{" "}
            <Link href="/problems" className="text-accent hover:underline">
              Pick a problem
            </Link>{" "}
            and run one.
          </div>
        ) : (
          <div className="panel divide-y divide-border overflow-hidden">
            {interviews.map((iv) => {
              const isAbandoned = iv.status === "ABANDONED";
              return (
                <Link
                  key={`${iv.kind}-${iv.id}`}
                  href={iv.href}
                  className="flex items-center gap-3 p-4 hover:bg-bg-surface transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{iv.title}</span>
                      {iv.difficulty && (
                        <DifficultyBadge value={iv.difficulty as Difficulty} />
                      )}
                      <TopicBadge value={iv.topic} />
                      <span
                        className="badge"
                        style={{
                          background: "rgb(var(--bg-inset))",
                          color: "rgb(var(--text-muted))",
                          borderColor: "rgb(var(--border-base))",
                        }}
                      >
                        {KIND_LABEL[iv.kind]}
                      </span>
                      {isAbandoned && (
                        <span
                          className="badge"
                          style={{
                            background: "rgb(var(--bg-inset))",
                            color: "rgb(var(--text-muted))",
                            borderColor: "rgb(var(--border-base))",
                          }}
                          title="Session ended without a debrief"
                        >
                          Ended
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-text-dim mt-0.5">
                      {iv.completedAt ? new Date(iv.completedAt).toLocaleString() : ""}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {isAbandoned ? (
                      <div className="text-xs text-text-dim">No scorecard</div>
                    ) : (
                      <>
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
                      </>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
