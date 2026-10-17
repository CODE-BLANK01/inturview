import Link from "next/link";
import {
  MarketingLayout,
  Section,
  SectionHeading,
  Cta,
  CtaBand,
  Eyebrow,
  Reveal,
  FeatureRow,
} from "@/components/marketing";
import { CheckoutButton } from "@/components/billing/CheckoutButton";
import {
  CANDIDATE_PLANS,
  priceLabel,
  priceSuffix,
  renderFeature,
} from "@/lib/plans";

export const metadata = {
  title: "Pricing — inturview",
  description:
    "Start practicing free. Get focused, time-boxed access with Interview Sprint when you need more room to practice.",
};
export default function PricingPage() {
  const sprint = CANDIDATE_PLANS.find((plan) => plan.tier === "PRO")!;
  return (
    <MarketingLayout>
      <Section className="m-pricing-hero">
        <Reveal hero>
          <SectionHeading
            as="h1"
            eyebrow="Pricing / For your next opportunity"
            deck="Start free. Find the gaps. When the interview is close, give yourself room to work on them."
          >
            Pay for the <em className="t-italic">sprint.</em>
            <br />
            Not the year.
          </SectionHeading>
        </Reveal>
        <div className="m-plan-grid">
          {CANDIDATE_PLANS.map((plan, i) => (
            <Reveal key={plan.tier} delay={i * 0.06}>
              <article
                className={
                  plan.tier === "FREE" ? "m-plan" : "m-plan m-plan-sprint"
                }
              >
                <div className="m-card-heading">
                  <Eyebrow>{plan.name}</Eyebrow>
                  <span className="m-neutral-badge">
                    {plan.tier === "FREE"
                      ? "A place to start"
                      : "Room to repeat"}
                  </span>
                </div>
                <div className="m-plan-price">
                  <strong className="t-display-1">{priceLabel(plan)}</strong>
                  <span>{priceSuffix(plan) || "No card required"}</span>
                </div>
                <p className="m-plan-tagline">{plan.tagline}</p>
                <ul className="m-features">
                  {plan.features.map((feature) => (
                    <FeatureRow key={feature}>
                      {renderFeature(feature, plan)}
                    </FeatureRow>
                  ))}
                </ul>
                <div className="m-plan-action">
                  {plan.tier === "FREE" ? (
                    <Cta />
                  ) : (
                    <CheckoutButton
                      label={`${plan.name} — ${priceLabel(plan)}`}
                      className="m-button m-button-secondary"
                    />
                  )}
                  <p className="m-caption">
                    {plan.tier === "FREE"
                      ? "Monthly limits reset automatically."
                      : "One payment. No automatic renewal."}
                  </p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </Section>
      <Section tone="inverse" size="md">
        <div className="m-split">
          <SectionHeading
            eyebrow="A little clarity"
            deck="Practice at your own pace. Your free account stays available when Sprint access ends."
          >
            More practice.
            <br />
            Fewer commitments.
          </SectionHeading>
          <div className="m-faq">
            {[
              [
                "What happens when my Sprint ends?",
                "Your account returns to the free plan and its monthly limits. Your completed debriefs and interview history stay with you.",
              ],
              [
                "Can I extend my access?",
                `Yes. Buy another ${sprint.name} pass whenever you need more time. An active pass extends from its current expiry; an expired pass starts again from purchase.`,
              ],
              [
                "What is included?",
                "Recruiter screens, behavioral practice, coding, and system design. Face-to-face video is being developed separately and is not part of this offer.",
              ],
              [
                "Do I need an account before paying?",
                "Yes. Create your account, verify your email, and finish onboarding first. Your payment is then linked to your practice account.",
              ],
            ].map(([question, answer]) => (
              <details key={question}>
                <summary>
                  {question}
                  <span aria-hidden="true">+</span>
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </Section>
      <Section size="sm">
        <div className="m-audience-note">
          <p>Hiring, rather than preparing for an interview?</p>
          <Link href="/employers">
            Meet Inturview Hire <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </Section>
      <CtaBand
        title="Start with one honest round."
        deck="You can decide how much practice you need after you have tried it."
      />
    </MarketingLayout>
  );
}
