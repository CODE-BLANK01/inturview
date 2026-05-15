import type { DashboardData } from "@/lib/dashboard";

export function TopicMastery({ topics }: { topics: DashboardData["topicMastery"] }) {
  const totalAttempted = topics.reduce((acc, t) => acc + t.attempted, 0);

  return (
    <section className="panel p-5">
      <div className="flex items-end justify-between mb-4">
        <div>
          <h2 className="font-semibold">Topic coverage</h2>
          <p className="text-xs text-text-dim mt-0.5">
            Unique problems attempted per NeetCode topic.
          </p>
        </div>
        <span className="text-xs text-text-dim tabular-nums">
          {totalAttempted}/{topics.reduce((acc, t) => acc + t.total, 0)} problems
        </span>
      </div>

      <ul className="space-y-2.5">
        {topics.map((t) => {
          const pct = t.total > 0 ? (t.attempted / t.total) * 100 : 0;
          const color =
            t.avgScore === null
              ? "bg-border-strong"
              : t.avgScore >= 20
              ? "bg-easy"
              : t.avgScore >= 15
              ? "bg-accent"
              : "bg-medium";
          return (
            <li key={t.topic} className="grid grid-cols-[1fr_72px_56px] gap-3 items-center text-sm">
              <div className="min-w-0">
                <div className="truncate">{t.topic}</div>
                <div className="mt-1 h-1.5 w-full rounded-full bg-bg-surface overflow-hidden">
                  <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
              <div className="text-xs text-text-dim tabular-nums text-right">
                {t.attempted}/{t.total}
              </div>
              <div className="text-xs tabular-nums text-right">
                {t.avgScore !== null ? (
                  <span className="text-text">{t.avgScore.toFixed(1)}</span>
                ) : (
                  <span className="text-text-dim">—</span>
                )}
                <span className="text-text-dim"> avg</span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
