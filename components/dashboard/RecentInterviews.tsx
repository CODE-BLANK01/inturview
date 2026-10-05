import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  Code2,
  MessageSquare,
  Network,
  Users,
  Video,
  FileCheck2,
} from "lucide-react";
import type { DashboardData } from "@/lib/dashboard";

const modeIcons: Record<string, typeof Code2> = {
  Coding: Code2,
  "System design": Network,
  Behavioral: Users,
  "Recruiter screen": MessageSquare,
  "Face-to-face": Video,
};

export function RecentInterviews({
  items,
}: {
  items: DashboardData["recent"];
}) {
  return (
    <section className="studio-panel recent-panel">
      <div className="section-heading">
        <div>
          <h2>Recent practice rounds</h2>
        </div>
        <Link href="/history" className="studio-text-link">
          View all <ArrowUpRight size={14} />
        </Link>
      </div>
      {items.length === 0 ? (
        <div className="dashboard-empty">
          <span className="empty-icon">
            <FileCheck2 size={25} />
          </span>
          <h3>Your first round starts here.</h3>
          <p>
            Complete an interview to see your feedback and track your progress.
          </p>
          <Link href="/recruiter-screen" className="studio-text-link">
            Start your first round <ArrowRight size={15} />
          </Link>
        </div>
      ) : (
        <ul className="recent-list">
          {items.map((iv) => {
            const Icon = modeIcons[iv.mode] ?? MessageSquare;
            return (
              <li key={iv.id}>
                <Link href={iv.href} className="recent-row">
                  <span className="recent-icon">
                    <Icon size={19} />
                  </span>
                  <div className="recent-description">
                    <strong>{iv.title}</strong>
                    <span>
                      {iv.mode}
                      {iv.completedAt
                        ? ` · ${iv.completedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`
                        : ""}
                    </span>
                  </div>
                  <span
                    className={`recent-score ${iv.totalScore !== null && iv.totalScore >= 20 ? "is-strong" : ""}`}
                  >
                    {iv.totalScore ?? "—"}
                    <small>/25</small>
                  </span>
                  <ArrowUpRight className="recent-arrow" size={17} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
