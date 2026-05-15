import type { DashboardData } from "@/lib/dashboard";

interface StatCellProps {
  label: string;
  value: string;
  sub?: string;
}

function StatCell({ label, value, sub }: StatCellProps) {
  return (
    <div className="p-5 first:rounded-l-lg last:rounded-r-lg border-l border-border first:border-l-0 flex-1 min-w-[140px]">
      <div className="text-[11px] uppercase tracking-[0.08em] text-text-dim">{label}</div>
      <div className="mt-2 text-2xl sm:text-3xl font-semibold tabular-nums tracking-tight">
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-text-dim">{sub}</div>}
    </div>
  );
}

export function StatGrid({ stats }: { stats: DashboardData["stats"] }) {
  return (
    <div className="panel flex divide-x divide-border overflow-x-auto">
      <StatCell
        label="Interviews"
        value={stats.interviewsCompleted.toString()}
        sub={
          stats.uniqueProblemsAttempted > 0
            ? `${stats.uniqueProblemsAttempted} unique problems`
            : "no completions yet"
        }
      />
      <StatCell
        label="Average score"
        value={stats.averageScore !== null ? `${stats.averageScore.toFixed(1)}` : "—"}
        sub={stats.averageScore !== null ? "out of 25" : "after first interview"}
      />
      <StatCell
        label="Best score"
        value={stats.bestScore !== null ? `${stats.bestScore}` : "—"}
        sub={stats.bestScore !== null ? "out of 25" : "no completions yet"}
      />
      <StatCell
        label="Days active"
        value={stats.daysActive.toString()}
        sub={stats.strongestTopic ? `Top: ${stats.strongestTopic.name}` : "build the habit"}
      />
    </div>
  );
}
