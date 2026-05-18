"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowLeft, Check, Lock, Loader2 } from "lucide-react";
import { PLANS, priceLabel, renderFeature } from "@/lib/plans";
import type { PlanDefinition } from "@/lib/plans";

type Goal = "PRACTICING" | "RECRUITING" | "COACHING" | "EXPLORING";

interface OnboardingWizardProps {
  /** Pre-populated from session — user can edit during onboarding. */
  initialName: string | null;
  email: string;
}

const GOAL_OPTIONS: { id: Goal; label: string; sub: string }[] = [
  {
    id: "PRACTICING",
    label: "Practicing for interviews",
    sub: "You've got a loop coming up and want to stop bombing the room.",
  },
  {
    id: "RECRUITING",
    label: "Hiring & evaluating candidates",
    sub: "You want a structured scorecard for the people you screen.",
  },
  {
    id: "COACHING",
    label: "Coaching others",
    sub: "You teach or mentor candidates through interview prep.",
  },
  {
    id: "EXPLORING",
    label: "Just exploring",
    sub: "Kicking the tires before you commit to a workflow.",
  },
];

export function OnboardingWizard({ initialName, email }: OnboardingWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState(initialName ?? "");
  const [goal, setGoal] = useState<Goal | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goNext = () => setStep(2);
  const goBack = () => setStep(1);

  const canContinueStep1 = goal !== null;

  const finish = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || null,
          goal,
          plan: "FREE",
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Failed (${res.status})`);
      }
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      <Stepper step={step} />

      {step === 1 ? (
        <section className="panel p-6 sm:p-8 mt-8">
          <h1 className="t-section-headline text-[28px] sm:text-[36px] mb-2">
            Let&apos;s start with you.
          </h1>
          <p className="t-body-light text-text-muted mb-7 text-[15px] max-w-xl">
            Two quick questions so the dashboard greets you the way you want and
            we steer you to the right surfaces. You can change either later.
          </p>

          <div className="space-y-6">
            <label className="block max-w-md">
              <span className="t-eyebrow">Your name</span>
              <input
                className="input mt-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ada Lovelace"
                autoComplete="name"
                maxLength={80}
              />
              <span className="block mt-1 text-xs text-text-dim">
                Optional. Signed in as <span className="text-text-muted">{email}</span>
              </span>
            </label>

            <fieldset className="space-y-2">
              <legend className="t-eyebrow mb-2">What brings you here?</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {GOAL_OPTIONS.map((g) => (
                  <GoalCard
                    key={g.id}
                    selected={goal === g.id}
                    onClick={() => setGoal(g.id)}
                    label={g.label}
                    sub={g.sub}
                  />
                ))}
              </div>
            </fieldset>
          </div>

          <div className="mt-8 flex items-center justify-between">
            <span className="text-xs text-text-dim">
              {canContinueStep1 ? "Pick a plan next." : "Pick the option that fits."}
            </span>
            <button
              type="button"
              onClick={goNext}
              disabled={!canContinueStep1}
              className="btn btn-primary"
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      ) : (
        <section className="mt-8 space-y-6">
          <header>
            <h1 className="t-section-headline text-[28px] sm:text-[36px]">
              Pick your plan.
            </h1>
            <p className="t-body-light text-text-muted mt-2 text-[15px] max-w-xl">
              Start free. Upgrade paths land soon — we&apos;ll be in your inbox
              before they go live.
            </p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PLANS.filter((p) => p.audience === "individual").map((p) => (
              <PlanCard key={p.tier} plan={p} />
            ))}
          </div>

          <details className="panel p-5 group">
            <summary className="cursor-pointer t-eyebrow flex items-center justify-between">
              <span>Hiring with a team?</span>
              <span className="text-text-muted normal-case tracking-normal text-xs group-open:hidden">
                Show team plans
              </span>
              <span className="text-text-muted normal-case tracking-normal text-xs hidden group-open:inline">
                Hide
              </span>
            </summary>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              {PLANS.filter((p) => p.audience !== "individual").map((p) => (
                <PlanCard key={p.tier} plan={p} compact />
              ))}
            </div>
          </details>

          {error && (
            <div className="panel border-hard/40 bg-hard-bg/30 px-3 py-2.5 text-sm text-hard">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={goBack}
              className="btn"
              disabled={submitting}
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <button
              type="button"
              onClick={finish}
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Continue with Free
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function Stepper({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex items-center gap-3">
      <StepDot n={1} active={step >= 1} done={step > 1} label="About you" />
      <span
        className="h-px flex-1 max-w-[120px]"
        style={{ background: "rgb(var(--border-base))" }}
        aria-hidden
      />
      <StepDot n={2} active={step >= 2} done={false} label="Plan" />
    </div>
  );
}

function StepDot({
  n,
  active,
  done,
  label,
}: {
  n: number;
  active: boolean;
  done: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="t-data text-[11px] inline-flex h-6 w-6 items-center justify-center rounded-full border"
        style={{
          background: active ? "rgb(var(--bg-inverse))" : "transparent",
          color: active ? "rgb(var(--text-inverse))" : "rgb(var(--text-tertiary))",
          borderColor: active
            ? "rgb(var(--bg-inverse))"
            : "rgb(var(--border-base))",
        }}
      >
        {done ? <Check className="h-3 w-3" /> : n.toString().padStart(2, "0")}
      </span>
      <span
        className={`t-eyebrow ${
          active ? "text-text" : "text-text-dim"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

function GoalCard({
  selected,
  onClick,
  label,
  sub,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-md p-3 border transition-colors duration-150 ${
        selected
          ? "border-text bg-bg-inset/40"
          : "border-border hover:border-border-strong hover:bg-bg-inset/30"
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span
          className={`t-cta text-[14px] ${
            selected ? "text-text" : "text-text-muted"
          }`}
        >
          {label}
        </span>
        {selected && (
          <Check
            className="h-3.5 w-3.5"
            style={{ color: "rgb(var(--text-ember))" }}
            aria-hidden
          />
        )}
      </div>
      <span className="block text-xs text-text-muted leading-relaxed">{sub}</span>
    </button>
  );
}

function PlanCard({ plan, compact }: { plan: PlanDefinition; compact?: boolean }) {
  const isFree = plan.tier === "FREE";
  const locked = !plan.selectable;
  return (
    <div
      className={`panel p-5 flex flex-col ${
        isFree ? "border-text" : ""
      } ${locked ? "opacity-90" : ""}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div
            className={`t-eyebrow ${isFree ? "text-text" : "text-text-muted"}`}
          >
            {plan.name}
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="t-display text-[28px] text-text leading-none">
              {priceLabel(plan)}
            </span>
            {plan.priceMonthlyCents !== null && plan.priceMonthlyCents > 0 && (
              <span className="text-xs text-text-dim">/ month</span>
            )}
          </div>
        </div>
        {isFree ? (
          <span
            className="badge"
            style={{
              background: "rgb(var(--bg-inverse))",
              color: "rgb(var(--text-inverse))",
              borderColor: "rgb(var(--bg-inverse))",
              fontWeight: 700,
            }}
          >
            Default
          </span>
        ) : (
          <span
            className="badge"
            style={{
              background: "rgb(var(--bg-inset))",
              color: "rgb(var(--text-muted))",
              borderColor: "rgb(var(--border-base))",
            }}
          >
            <Lock className="h-3 w-3 mr-1 inline-block" />
            {plan.availabilityNote ?? "Coming soon"}
          </span>
        )}
      </div>

      {!compact && (
        <p className="text-sm text-text-muted leading-relaxed mb-4">
          {plan.tagline}
        </p>
      )}

      <ul className="space-y-1.5 text-sm text-text-muted">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <Check
              className="h-3.5 w-3.5 mt-1 shrink-0"
              style={{ color: isFree ? "rgb(var(--text-ember))" : "rgb(var(--text-tertiary))" }}
              aria-hidden
            />
            <span>{renderFeature(f, plan)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
