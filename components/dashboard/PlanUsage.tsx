import { ArrowUpRight, Lock } from "lucide-react";
import type { PlanDefinition } from "@/lib/plans";
import { priceLabel } from "@/lib/plans";

interface PlanUsageProps {
  plan: PlanDefinition;
  interviewsThisMonth: number;
}

function daysUntilReset(): number {
  const now = new Date();
  const nextMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
  );
  return Math.max(1, Math.ceil((nextMonth.getTime() - now.getTime()) / 86_400_000));
}

export function PlanUsage({ plan, interviewsThisMonth }: PlanUsageProps) {
  const limit = plan.interviewsPerMonth;
  const used = interviewsThisMonth;
  const unlimited = limit === null;
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / (limit || 1)) * 100));
  const remaining = unlimited ? null : Math.max(0, limit! - used);
  const atOrNearLimit = !unlimited && used >= (limit ?? 0);
  const warningThreshold = !unlimited && limit !== null && limit > 0 && used / limit >= 0.8;

  const resetDays = daysUntilReset();

  return (
    <section className="panel p-5">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 items-start">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
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
          </div>
          <p className="text-sm text-text-muted leading-snug">
            {unlimited ? (
              "Unlimited interviews on your plan."
            ) : (
              <>
                <span className="t-data text-[15px] text-text">
                  {used} / {limit}
                </span>{" "}
                <span className="text-text-muted">
                  interviews this month —{" "}
                  {atOrNearLimit
                    ? "limit reached."
                    : `${remaining} left, resets in ${resetDays}d.`}
                </span>
              </>
            )}
          </p>

          {!unlimited && (
            <div className="mt-3 h-[6px] w-full max-w-md overflow-hidden rounded-full bg-bg-inset">
              <div
                className={`h-full transition-[width] duration-300 ${
                  atOrNearLimit ? "bg-hard" : warningThreshold ? "bg-medium" : "bg-text"
                }`}
                style={{ width: `${pct}%` }}
                aria-label={`${pct}% used`}
              />
            </div>
          )}
        </div>

        <div className="flex sm:flex-col items-start sm:items-end gap-2">
          <UpgradeCta />
        </div>
      </div>
    </section>
  );
}

function UpgradeCta() {
  // Payments aren't wired up yet — clicking does nothing but signal intent.
  // Replace with a Link to /billing or /upgrade when billing ships.
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
