import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { DashboardData } from "@/lib/dashboard";

export function TopicMastery({
  topics,
}: {
  topics: DashboardData["topicMastery"];
}) {
  const attempted = topics.reduce((sum, t) => sum + t.attempted, 0);
  const total = topics.reduce((sum, t) => sum + t.total, 0);
  const sorted = [...topics].sort((a, b) => b.attempted - a.attempted);
  function row(t: DashboardData["topicMastery"][number]) {
    return (
      <li key={t.topic} className="topic-row">
        <div>
          <span>{t.topic}</span>
          <span>
            {t.attempted}
            <span className="text-text-dim"> / {t.total}</span>
          </span>
        </div>
        <div className="topic-track">
          <div
            style={{
              width: `${t.total ? Math.min(100, (t.attempted / t.total) * 100) : 0}%`,
            }}
          />
        </div>
      </li>
    );
  }
  return (
    <section className="studio-panel topic-panel">
      <div className="section-heading">
        <div>
          <h2>Build your range</h2>
          <p>
            Coding topics · {attempted} of {total} problems completed
          </p>
        </div>
        <Link
          href="/problems"
          className="studio-icon-button"
          aria-label="Browse coding problems"
        >
          <ArrowUpRight size={17} />
        </Link>
      </div>
      <ul className="topic-list">{sorted.slice(0, 5).map(row)}</ul>
      {sorted.length > 5 && (
        <details className="topic-expand">
          <summary>
            Explore all {sorted.length} topics <span aria-hidden="true">+</span>
          </summary>
          <ul className="topic-list">{sorted.slice(5).map(row)}</ul>
        </details>
      )}
    </section>
  );
}
