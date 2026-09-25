import Link from "next/link";
import { Check } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { CheckoutButton } from "@/components/billing/CheckoutButton";
import {
  CANDIDATE_PLANS,
  priceLabel,
  priceSuffix,
  renderFeature,
  type PlanDefinition,
} from "@/lib/plans";

export const metadata = {
  title: "Pricing — inturview",
  description: "Simple interview-practice pricing for candidates, with employer screening kept separate.",
};

export default function PricingPage() {
  return (
    <>
      <TopNav />
      <main>
        <section className="border-b border-border">
          <div className="mx-auto max-w-6xl px-6 sm:px-12 py-20 sm:py-28">
            <p className="t-eyebrow mb-6">Pricing for candidates</p>
            <h1 className="t-display text-text text-[40px] sm:text-[56px] md:text-[64px] max-w-4xl">
              Practice for the interview.
              <br />
              Pay for the <span className="t-italic">sprint</span>, not a year.
            </h1>
            <p className="t-body mt-8 max-w-2xl text-text-muted">
              Start free and learn where your answers break down. When your interview
              is close, unlock thirty focused days of unlimited practice. No team seats,
              annual contract, or employer access to your practice history.
            </p>

            <div className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl">
              {CANDIDATE_PLANS.map((plan) => (
                <CandidatePlanCard key={plan.tier} plan={plan} />
              ))}
            </div>
          </div>
        </section>

        <section className="surface-inverse border-b border-border">
          <div className="mx-auto max-w-6xl px-6 sm:px-12 py-12 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <p className="t-eyebrow text-text-ember">Hiring candidates?</p>
              <p className="t-body text-text-inverse mt-2">
                Inturview Hire is a separate employer screening product.
              </p>
            </div>
            <Link href="/employers" className="btn shrink-0">
              Explore employer screening
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}

function CandidatePlanCard({ plan }: { plan: PlanDefinition }) {
  const isFree = plan.tier === "FREE";

  return (
    <article className={`panel p-6 sm:p-7 flex flex-col ${isFree ? "border-text" : ""}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="t-eyebrow">{plan.name}</p>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="t-display text-[38px] text-text leading-none">{priceLabel(plan)}</span>
            <span className="text-xs text-text-dim">{priceSuffix(plan)}</span>
          </div>
        </div>
        <span className="badge border-border bg-bg-surface text-text-muted">
          {isFree ? "Available now" : plan.availabilityNote}
        </span>
      </div>

      <p className="text-sm text-text-muted leading-relaxed mt-5">{plan.tagline}</p>
      <ul className="mt-6 space-y-2 text-sm text-text-muted flex-1">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <Check className="h-4 w-4 mt-0.5 shrink-0 text-text-ember" aria-hidden />
            <span>{renderFeature(feature, plan)}</span>
          </li>
        ))}
      </ul>

      {isFree ? (
        <Link href="/signup" className="btn btn-primary mt-7">
          Start practicing free
        </Link>
      ) : (
        <div className="mt-7">
          <CheckoutButton
            label="Get 30 days — $19"
            className="btn btn-primary w-full"
          />
          <p className="mt-2 text-xs text-text-dim">
            One payment. Buy another pass whenever you want more time.
          </p>
        </div>
      )}
    </article>
  );
}
