import Link from "next/link";
import { ArrowRight, Users as UsersIcon, Database, Activity, AlertTriangle } from "lucide-react";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const since24h = new Date(Date.now() - 24 * 60 * 60_000);
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60_000);

  const [
    userCount,
    flaggedCount,
    disabledCount,
    adminCount,
    problemCount,
    interviewTotal,
    interviewCompleted,
    interviewActive,
    interviewEarly,
    recent7d,
    recentInterviews,
    recentAudit,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { flagged: true } }),
    prisma.user.count({ where: { disabledAt: { not: null } } }),
    prisma.user.count({ where: { role: "ADMIN" } }),
    prisma.problem.count(),
    prisma.interview.count(),
    prisma.interview.count({ where: { status: "COMPLETED" } }),
    prisma.interview.count({ where: { startedAt: { gte: since24h } } }),
    prisma.interview.count({ where: { movedToCodeEarly: true } }),
    prisma.user.count({ where: { createdAt: { gte: since7d } } }),
    prisma.interview.findMany({
      orderBy: { startedAt: "desc" },
      take: 8,
      select: {
        id: true,
        status: true,
        startedAt: true,
        totalScore: true,
        recommendation: true,
        user: { select: { email: true } },
        problem: { select: { title: true } },
      },
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        action: true,
        targetType: true,
        targetId: true,
        createdAt: true,
        admin: { select: { email: true } },
      },
    }),
  ]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-text-muted mt-1">
          Snapshot of users, problems, and interview activity across the platform.
        </p>
      </header>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border rounded-lg overflow-hidden">
        <StatTile
          label="Users"
          value={userCount.toString()}
          sub={`${adminCount} admin · ${recent7d} new this week`}
          icon={UsersIcon}
        />
        <StatTile
          label="Problems"
          value={problemCount.toString()}
          sub="seeded + admin-created"
          icon={Database}
        />
        <StatTile
          label="Interviews"
          value={interviewTotal.toString()}
          sub={`${interviewCompleted} completed · ${interviewActive} started 24h`}
          icon={Activity}
        />
        <StatTile
          label="Flags"
          value={(flaggedCount + disabledCount).toString()}
          sub={`${flaggedCount} flagged · ${disabledCount} disabled · ${interviewEarly} early skips`}
          icon={AlertTriangle}
          tone={flaggedCount + disabledCount > 0 ? "warn" : "default"}
        />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="panel p-5">
          <div className="flex items-end justify-between mb-3">
            <h2 className="font-semibold">Recent interviews</h2>
            <Link
              href="/admin/interviews"
              className="text-xs text-text-muted hover:text-text inline-flex items-center gap-0.5"
            >
              All <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {recentInterviews.length === 0 ? (
            <p className="text-sm text-text-dim py-2">No interviews yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {recentInterviews.map((iv) => (
                <li
                  key={iv.id}
                  className="flex items-center gap-3 py-1.5 border-b border-border last:border-0"
                >
                  <span
                    className={`badge ${
                      iv.status === "COMPLETED"
                        ? "border-easy/40 bg-easy/10 text-easy"
                        : iv.status === "IN_PROGRESS"
                        ? "border-accent/40 bg-accent/10 text-accent"
                        : "border-border bg-bg-surface text-text-dim"
                    }`}
                  >
                    {iv.status.toLowerCase().replace("_", " ")}
                  </span>
                  <span className="font-medium truncate flex-1">{iv.problem.title}</span>
                  <span className="text-xs text-text-dim truncate max-w-[140px]">
                    {iv.user.email}
                  </span>
                  <span className="text-xs tabular-nums text-text-dim shrink-0">
                    {iv.totalScore !== null ? `${iv.totalScore}/25` : "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel p-5">
          <div className="flex items-end justify-between mb-3">
            <h2 className="font-semibold">Recent admin actions</h2>
            <Link
              href="/admin/audit"
              className="text-xs text-text-muted hover:text-text inline-flex items-center gap-0.5"
            >
              Full log <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {recentAudit.length === 0 ? (
            <p className="text-sm text-text-dim py-2">No admin actions yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {recentAudit.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center gap-3 py-1.5 border-b border-border last:border-0"
                >
                  <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-dim">
                    {a.action.toLowerCase().replace(/_/g, " ")}
                  </span>
                  <span className="text-xs text-text-dim truncate flex-1">
                    {a.targetType} · {a.targetId.slice(0, 12)}
                  </span>
                  <span className="text-xs text-text-dim truncate max-w-[140px]">
                    {a.admin.email}
                  </span>
                  <span className="text-xs text-text-dim shrink-0">
                    {new Date(a.createdAt).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "warn" | "default";
}) {
  return (
    <div
      className={`p-5 ${
        tone === "warn"
          ? "bg-medium/[0.04]"
          : "bg-bg-elevated"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[0.08em] text-text-dim">{label}</span>
        <Icon className={`h-4 w-4 ${tone === "warn" ? "text-medium" : "text-text-dim"}`} />
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-xs text-text-dim">{sub}</div>}
    </div>
  );
}
