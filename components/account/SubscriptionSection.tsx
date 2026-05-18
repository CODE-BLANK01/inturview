"use client";

import { Lock, ArrowUpRight } from "lucide-react";
import type { PlanDefinition } from "@/lib/plans";
import { priceLabel, renderFeature, PLANS } from "@/lib/plans";
import { SectionHeader } from "./ProfileSection";

interface SubscriptionSectionProps {
  plan: PlanDefinition;
  interviewsThisMonth: number;
}

function daysUntilReset(): number {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return Math.max(1, Math.ceil((next.getTime() - now.getTime()) / 86_400_000));
}

export function SubscriptionSection({ plan, interviewsThisMonth }: SubscriptionSectionProps) {
  const limit = plan.interviewsPerMonth;
  const unlimited = limit === null;
  const pct = unlimited ? 0 : Math.min(100, Math.round((interviewsThisMonth / (limit || 1)) * 100));
  const atOrNearLimit = !unlimited && interviewsThisMonth >= (limit ?? 0);
  const warning = !unlimited && limit !== null && limit > 0 && interviewsThisMonth / limit >= 0.8;

  const upgradeCandidates = PLANS.filter((p) => p.tier !== plan.tier && p.audience === "individual");

  return (
    <section>
      <SectionHeader
        eyebrow="Subscription"
        title="Plan & usage."
        sub="Free for now. Paid plans land soon — no card needed today."
      />

      <div className="panel p-6 space-y-6">
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
              {plan.priceMonthlyCents && plan.priceMonthlyCents > 0 && (
                <span className="text-xs text-text-dim">/ month</span>
              )}
            </div>
            <p className="text-sm text-text-muted mt-2 max-w-md leading-snug">
              {plan.tagline}
            </p>
          </div>

          <button
            type="button"
            disabled
            className="btn text-xs cursor-not-allowed opacity-80"
            title="Paid upgrade plans are coming soon"
          >
            <Lock className="h-3 w-3" />
            Upgrade
            <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>

        {/* Usage row */}
        <div>
          <span className="t-eyebrow">Usage this month</span>
          <div className="mt-2 flex items-baseline justify-between gap-2 flex-wrap">
            <p className="text-sm text-text-muted">
              {unlimited ? (
                <span className="text-text">Unlimited interviews on your plan.</span>
              ) : (
                <>
                  <span className="t-data text-[15px] text-text">
                    {interviewsThisMonth} / {limit}
                  </span>{" "}
                  <span className="text-text-muted">
                    interviews —{" "}
                    {atOrNearLimit
                      ? "you've hit the cap."
                      : `${(limit ?? 0) - interviewsThisMonth} left, resets in ${daysUntilReset()}d.`}
                  </span>
                </>
              )}
            </p>
          </div>

          {!unlimited && (
            <div className="mt-3 h-[6px] w-full overflow-hidden rounded-full bg-bg-inset">
              <div
                className={`h-full transition-[width] duration-300 ${
                  atOrNearLimit ? "bg-hard" : warning ? "bg-medium" : "bg-text"
                }`}
                style={{ width: `${pct}%` }}
                aria-label={`${pct}% used`}
              />
            </div>
          )}
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

        {/* Coming-soon comparison row */}
        {upgradeCandidates.length > 0 && (
          <div
            className="rounded-md border border-dashed p-4"
            style={{ borderColor: "rgb(var(--border-base))" }}
          >
            <p className="t-eyebrow mb-2">What lands when billing ships</p>
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
                    {p.priceMonthlyCents && p.priceMonthlyCents > 0 ? "/mo" : ""}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-text-dim mt-3">
              We&apos;ll email you when Pro opens up. No surprise charges.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
