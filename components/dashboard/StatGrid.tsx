import type { DashboardData } from "@/lib/dashboard";

export function StatGrid({ stats }: { stats: DashboardData["stats"] }) {
  const items = [
    { label: "Rounds completed", value: stats.interviewsCompleted, suffix: "" },
    { label: "Average score", value: stats.averageScore?.toFixed(1) ?? "—", suffix: stats.averageScore === null ? "" : "/25" },
    { label: "Personal best", value: stats.bestScore ?? "—", suffix: stats.bestScore === null ? "" : "/25" },
    { label: "Practice days", value: stats.daysActive, suffix: "" },
  ];
  return (
    <dl className="dashboard-stats">
      {items.map(({ label, value, suffix }) => (
        <div className="dashboard-stat" key={label}>
          <dt>{label}</dt>
          <dd>{value}<span>{suffix}</span></dd>
        </div>
      ))}
    </dl>
  );
}
