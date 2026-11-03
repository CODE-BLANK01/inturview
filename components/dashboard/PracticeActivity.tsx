import type { DashboardData } from "@/lib/dashboard";
import { StatGrid } from "./StatGrid";

export function PracticeActivity({ activity, stats }: {
  activity: DashboardData["activity"];
  stats: DashboardData["stats"];
}) {
  const total = activity.reduce((sum, day) => sum + day.count, 0);
  const maximum = Math.max(3, ...activity.map((day) => day.count));
  return (
    <section className="studio-panel activity-panel">
      <div className="section-heading">
        <h2>Your progress</h2>
        <span className="progress-period">All time</span>
      </div>
      <StatGrid stats={stats} />
      <div className="activity-summary">
        <h3>Last 7 days</h3>
        <span>{total} {total === 1 ? "round" : "rounds"} completed</span>
      </div>
      <div className="activity-chart" role="img" aria-label={`Completed rounds over the last seven UTC days: ${activity.map((day) => `${day.date}: ${day.count}`).join(", ")}`}>
        {activity.map((day, index) => (
          <div key={day.date} className={`activity-day ${index === 6 ? "is-today" : ""}`} title={`${day.date}: ${day.count} completed`}>
            <div className="activity-track">
              <div className="activity-fill" style={{ height: `${(day.count / maximum) * 100}%`, minHeight: day.count ? 6 : 0 }} />
            </div>
            <span>{new Date(`${day.date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
