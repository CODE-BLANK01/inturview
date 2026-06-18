import { ArrowUpRight, Lock } from "lucide-react";
import type { PlanDefinition } from "@/lib/plans";
import { priceLabel } from "@/lib/plans";

interface PlanUsageProps {
  plan: PlanDefinition;
  interviewsThisMonth: number;
  designSessionsThisMonth: number;
  behavioralSessionsThisMonth: number;
  recruiterSessionsThisMonth: number;
}

function daysUntilReset(): number {
  const now = new Date();
  const nextMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
  );
  return Math.max(1, Math.ceil((nextMonth.getTime() - now.getTime()) / 86_400_000));
}

export function PlanUsage({
  plan,
  interviewsThisMonth,
  designSessionsThisMonth,
  behavioralSessionsThisMonth,
  recruiterSessionsThisMonth,
}: PlanUsageProps) {
  const resetDays = daysUntilReset();
  const meters = [
    {
      label: "Coding",
      used: interviewsThisMonth,
      limit: plan.interviewsPerMonth,
    },
    {
      label: "System design",
      used: designSessionsThisMonth,
      limit: plan.designSessionsPerMonth,
    },
    {
      label: "Behavioral",
      used: behavioralSessionsThisMonth,
      limit: plan.behavioralSessionsPerMonth,
    },
    {
      label: "Recruiter screen",
      used: recruiterSessionsThisMonth,
      limit: plan.recruiterSessionsPerMonth,
    },
  ];

  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="t-eyebrow">Plan</span>
          <span
            className="badge"
            style={{
              background: "rgb(var(--bg-inverse))",
              color: "rgb(var(--text-inverse))",
              borderColor: "rgb(var(--bg-inverse))",
              fontWeight: 700,
            }}
          >
            {plan.name}
          </span>
          <span className="text-xs text-text-dim tabular-nums">
            {priceLabel(plan)}
            {plan.priceMonthlyCents && plan.priceMonthlyCents > 0 ? " / mo" : ""}
          </span>
          <span className="text-xs text-text-dim">· resets in {resetDays}d</span>
        </div>
        <UpgradeCta />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
        {meters.map((m) => (
          <Meter key={m.label} label={m.label} used={m.used} limit={m.limit} />
        ))}
      </div>
    </section>
  );
}

function Meter({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number | null;
}) {
  const unlimited = limit === null;
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / (limit || 1)) * 100));
  const atLimit = !unlimited && used >= (limit ?? 0);
  const warning = !unlimited && limit !== null && limit > 0 && used / limit >= 0.8;
  const bar = atLimit ? "bg-hard" : warning ? "bg-medium" : "bg-text";

  return (
    <div>
      <div className="flex items-baseline justify-between text-sm mb-1.5">
        <span className="text-text-muted">{label}</span>
        <span className="t-data tabular-nums">
          {used}
          {unlimited ? (
            <span className="text-text-dim text-xs"> · unlimited</span>
          ) : (
            <>
              <span className="text-text-dim"> / {limit}</span>
            </>
          )}
        </span>
      </div>
      <div className="h-[6px] w-full overflow-hidden rounded-full bg-bg-inset">
        {unlimited ? (
          <div className="h-full bg-easy/40" style={{ width: "100%" }} />
        ) : (
          <div
            className={`h-full transition-[width] duration-300 ${bar}`}
            style={{ width: `${pct}%` }}
            aria-label={`${label} ${pct}% used`}
          />
        )}
      </div>
    </div>
  );
}

function UpgradeCta() {
  return (
    <button
      type="button"
      disabled
      title="Upgrade plans are launching soon"
      className="btn text-xs cursor-not-allowed opacity-80"
    >
      <Lock className="h-3 w-3" />
      Upgrade
      <ArrowUpRight className="h-3 w-3" />
    </button>
  );
}
