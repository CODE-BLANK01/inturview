import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { DashboardData } from "@/lib/dashboard";
import { DifficultyBadge, RecommendationBadge } from "@/components/Badges";
import type { Difficulty, Debrief } from "@/lib/types";

export function RecentInterviews({ items }: { items: DashboardData["recent"] }) {
  return (
    <section className="panel p-5">
      <div className="flex items-end justify-between mb-3">
        <h2 className="font-semibold">Recent interviews</h2>
        <Link href="/history" className="text-xs text-text-muted hover:text-text inline-flex items-center gap-0.5">
          View all <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-text-dim py-2">
          Nothing yet. Your completed interviews will show here.
        </p>
      ) : (
        <ul className="divide-y divide-border -mx-5">
          {items.map((iv) => (
            <li key={iv.id}>
              <Link
                href={`/history/${iv.id}`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-bg-surface transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{iv.problem.title}</span>
                    <DifficultyBadge value={iv.problem.difficulty as Difficulty} />
                  </div>
                  <div className="mt-0.5 text-xs text-text-dim">
                    {iv.problem.topic}
                    {iv.completedAt
                      ? ` · ${new Date(iv.completedAt).toLocaleDateString()}`
                      : ""}
                  </div>
                </div>
                <div className="text-right text-sm tabular-nums shrink-0">
                  {iv.totalScore ?? "—"}
                  <span className="text-text-dim">/25</span>
                </div>
                {iv.recommendation && (
                  <RecommendationBadge
                    value={iv.recommendation as Debrief["overall_recommendation"]}
                  />
                )}
                <ChevronRight className="h-4 w-4 text-text-dim shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
