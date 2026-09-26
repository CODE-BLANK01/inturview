"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import type { PlanDefinition } from "@/lib/plans";
import { CANDIDATE_PLANS, priceLabel, priceSuffix, renderFeature } from "@/lib/plans";
import { CheckoutButton } from "@/components/billing/CheckoutButton";
import { SectionHeader } from "./ProfileSection";

interface SubscriptionSectionProps {
  plan: PlanDefinition;
  usage: {
    interviewsThisMonth: number;
    designSessionsThisMonth: number;
    behavioralSessionsThisMonth: number;
    recruiterSessionsThisMonth: number;
  };
  planExpiresAt: string | null;
  checkoutStatus?: "success" | "canceled";
}

function computeDaysUntilReset(): number {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return Math.max(1, Math.ceil((next.getTime() - now.getTime()) / 86_400_000));
}

export function SubscriptionSection({
  plan,
  usage,
  planExpiresAt,
  checkoutStatus,
}: SubscriptionSectionProps) {
  const router = useRouter();
  const [checkoutNoticeVisible, setCheckoutNoticeVisible] = useState(
    Boolean(checkoutStatus)
  );
  // Compute days-until-reset only after mount. Calling new Date() during
  // render would put a stamp in SSR HTML that could diff against the client's
  // first render (server runs in UTC; if it ticks over midnight between SSR
  // and hydration, the day count drifts). Null until ready, then the line
  // re-renders with the real value.
  const [daysUntilReset, setDaysUntilReset] = useState<number | null>(null);
  useEffect(() => {
    setDaysUntilReset(computeDaysUntilReset());
  }, []);

  // Stripe redirects back immediately after Checkout, while its webhook can
  // arrive a moment later. Refresh the server component until the verified
  // webhook changes the effective plan, instead of leaving the user on a
  // stale "confirming" screen.
  useEffect(() => {
    if (checkoutStatus !== "success" || plan.tier === "PRO") return;
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      router.refresh();
      if (attempts >= 10) window.clearInterval(timer);
    }, 1_500);
    return () => window.clearInterval(timer);
  }, [checkoutStatus, plan.tier, router]);

  const dismissCheckoutNotice = () => {
    setCheckoutNoticeVisible(false);
    const url = new URL(window.location.href);
    url.searchParams.delete("checkout");
    url.searchParams.delete("session_id");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  };

  const upgradeCandidates = CANDIDATE_PLANS.filter(
    (candidate) =>
      candidate.priceCents !== null &&
      plan.priceCents !== null &&
      candidate.priceCents > plan.priceCents
  );
  const meters = [
    {
      label: "Recruiter screen",
      used: usage.recruiterSessionsThisMonth,
      limit: plan.recruiterSessionsPerMonth,
    },
    {
      label: "Behavioral",
      used: usage.behavioralSessionsThisMonth,
      limit: plan.behavioralSessionsPerMonth,
    },
    {
      label: "Coding",
      used: usage.interviewsThisMonth,
      limit: plan.interviewsPerMonth,
    },
    {
      label: "System design",
      used: usage.designSessionsThisMonth,
      limit: plan.designSessionsPerMonth,
    },
  ];

  return (
    <section>
      <SectionHeader
        eyebrow="Subscription"
        title="Plan & usage."
        sub={
          plan.tier === "FREE"
            ? "Start free, then unlock thirty focused days whenever you need them."
            : "Your current candidate practice access and usage."
        }
      />

      <div className="panel p-6 space-y-6">
        {checkoutNoticeVisible && checkoutStatus === "success" && (
          <div className="rounded-md border border-easy/40 bg-easy/10 px-4 py-3 text-sm text-text flex items-center justify-between gap-4">
            <span>
              {plan.tier === "PRO" ? (
                "Payment confirmed. Your Interview Sprint access is ready."
              ) : (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Checkout completed. Confirming your payment…
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={dismissCheckoutNotice}
              className="shrink-0 rounded p-1 text-text-muted hover:bg-bg-inset hover:text-text transition-colors"
              aria-label="Dismiss payment confirmation"
              title="Dismiss"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        )}
        {checkoutNoticeVisible && checkoutStatus === "canceled" && (
          <div className="rounded-md border border-border bg-bg-inset/40 px-4 py-3 text-sm text-text-muted flex items-center justify-between gap-4">
            <span>Checkout was canceled. You were not charged.</span>
            <button
              type="button"
              onClick={dismissCheckoutNotice}
              className="shrink-0 rounded p-1 text-text-muted hover:bg-bg-inset hover:text-text transition-colors"
              aria-label="Dismiss checkout notice"
              title="Dismiss"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        )}
        {/* Current plan row */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="t-eyebrow">Current plan</span>
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
            </div>
            <div className="flex items-baseline gap-2">
              <span className="t-display text-2xl text-text leading-none">
                {priceLabel(plan)}
              </span>
              {priceSuffix(plan) && (
                <span className="text-xs text-text-dim">{priceSuffix(plan)}</span>
              )}
            </div>
            <p className="text-sm text-text-muted mt-2 max-w-md leading-snug">
              {plan.tagline}
            </p>
            {plan.tier === "PRO" && planExpiresAt && (
              <p className="text-sm text-text mt-2">
                Access through{" "}
                <span className="font-medium">
                  {new Intl.DateTimeFormat("en-US", {
                    dateStyle: "long",
                    timeZone: "UTC",
                  }).format(new Date(planExpiresAt))}
                </span>
              </p>
            )}
          </div>

          <CheckoutButton
            label={
              plan.tier === "PRO"
                ? "Extend 30 days — $19"
                : "Get 30 days — $19"
            }
            className="btn btn-primary text-xs"
          />
        </div>

        {/* Usage row */}
        <div>
          <span className="t-eyebrow">Usage this month</span>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
            {meters.map((meter) => (
              <UsageMeter
                key={meter.label}
                label={meter.label}
                used={meter.used}
                limit={meter.limit}
                daysUntilReset={daysUntilReset}
              />
            ))}
          </div>
        </div>

        {/* Features included */}
        <div>
          <span className="t-eyebrow">What&apos;s included</span>
          <ul className="mt-2 space-y-1.5 text-sm text-text-muted">
            {plan.features.map((f) => (
              <li key={f} className="flex items-start gap-2">
                <span
                  className="mt-2 inline-block h-1 w-1 rounded-full shrink-0"
                  style={{ background: "rgb(var(--text-ember))" }}
                  aria-hidden
                />
                <span>{renderFeature(f, plan)}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Paid-pass comparison row */}
        {upgradeCandidates.length > 0 && (
          <div
            className="rounded-md border border-dashed p-4"
            style={{ borderColor: "rgb(var(--border-base))" }}
          >
            <p className="t-eyebrow mb-2">When your interview is close</p>
            <ul className="space-y-2">
              {upgradeCandidates.map((p) => (
                <li
                  key={p.tier}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <div className="min-w-0">
                    <span className="text-text font-medium">{p.name}</span>
                    <span className="text-text-muted">  ·  {p.tagline}</span>
                  </div>
                  <span className="t-data text-text-muted text-xs shrink-0">
                    {priceLabel(p)}
                    {priceSuffix(p)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-text-dim mt-3">
              One payment, no automatic renewal. Another purchase adds 30 days
              after any access you still have.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function UsageMeter({
  label,
  used,
  limit,
  daysUntilReset,
}: {
  label: string;
  used: number;
  limit: number | null;
  daysUntilReset: number | null;
}) {
  const unlimited = limit === null;
  const pct = unlimited ? 100 : Math.min(100, Math.round((used / (limit || 1)) * 100));
  const atLimit = !unlimited && used >= (limit ?? 0);
  const warning = !unlimited && limit !== null && limit > 0 && used / limit >= 0.8;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm mb-1.5">
        <span className="text-text-muted">{label}</span>
        <span className="t-data tabular-nums text-text">
          {used}
          {unlimited ? (
            <span className="text-text-dim text-xs"> · unlimited</span>
          ) : (
            <span className="text-text-dim"> / {limit}</span>
          )}
        </span>
      </div>
      <div className="h-[6px] w-full overflow-hidden rounded-full bg-bg-inset">
        <div
          className={`h-full transition-[width] duration-300 ${
            unlimited ? "bg-easy/40" : atLimit ? "bg-hard" : warning ? "bg-medium" : "bg-text"
          }`}
          style={{ width: `${pct}%` }}
          aria-label={`${label} ${unlimited ? "unlimited" : `${pct}% used`}`}
        />
      </div>
      {!unlimited && daysUntilReset !== null && (
        <p className="text-[11px] text-text-dim mt-1">
          {atLimit ? "Cap reached" : `${Math.max(0, limit - used)} left`} · resets in {daysUntilReset}d
        </p>
      )}
    </div>
  );
}
