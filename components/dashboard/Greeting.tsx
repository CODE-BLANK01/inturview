import type { ReactNode } from "react";
import type { DashboardData } from "@/lib/dashboard";

export function Greeting({
  name,
  stats,
  children,
}: {
  name: string | null;
  stats: DashboardData["stats"];
  children: ReactNode;
}) {
  const first = (name ?? "").split(/\s+|@/)[0];
  return (
    <header className="dashboard-welcome">
      <div className="welcome-copy">
        <p className="studio-label">Interview practice</p>
        <h1>
          {stats.interviewsCompleted ? "Welcome back" : "Welcome"}
          {first ? `, ${first}` : ""}
          <span className="welcome-period">.</span>
        </h1>
        <p className="welcome-description">
          Choose a round, practice your answers, and see what to improve.
        </p>
      </div>
      {children}
    </header>
  );
}
