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
import { PLANS } from "@/lib/plans";
export const metadata = {
  title: "Inturview Hire — design partners",
  description:
    "Help shape structured AI screening interviews, evidence-backed scorecards, and a better shortlist.",
};
const FLOW = [
  [
    "01",
    "Create",
    "Define the role, questions, and evidence that should move a candidate forward.",
  ],
  [
    "02",
    "Invite",
    "Send each candidate the same structured AI screening interview.",
  ],
  [
    "03",
    "Shortlist",
    "Compare scorecards, inspect evidence, and choose who reaches a human interview.",
  ],
] as const;
export default function EmployersPage() {
  const pilot = PLANS.find((plan) => plan.tier === "TEAM_STARTER")!;
  return (
    <MarketingLayout>
      <Section className="m-employer-hero">
        <Reveal hero>
          <SectionHeading
            as="h1"
            eyebrow="Inturview Hire / Design partners"
            deck="Structured AI screening before the human round. Help us build a workflow that gives your team evidence to discuss, not another pile of résumés."
          >
            Let the answers
            <br />
            make the <em className="t-italic">introduction.</em>
          </SectionHeading>
          <div className="m-actions">
            <Cta href="/contact?topic=employers">Become a design partner</Cta>
            <Cta href="#how-it-works" secondary>
              How it works
            </Cta>
          </div>
          <p className="m-caption m-hero-note">
            In development. Built with a small group of hiring teams.
          </p>
        </Reveal>
        <div
          className="m-employer-sequence"
          aria-label="Create, invite, shortlist"
        >
          {FLOW.map(([n, title]) => (
            <div key={n}>
              <span className="t-eyebrow">{n}</span>
              <span className="t-display-3">{title}</span>
              <span aria-hidden="true">↗</span>
            </div>
          ))}
        </div>
      </Section>
      <Section id="how-it-works" tone="inverse">
        <SectionHeading
          eyebrow="The workflow"
          deck="Set the criteria before the interview. Follow the evidence after it."
        >
          Three steps.
          <br />A more useful first round.
        </SectionHeading>
        <div className="m-step-grid">
          {FLOW.map(([n, title, body], i) => (
            <Reveal key={n} delay={i * 0.06}>
              <article className="m-step">
                <span className="m-step-number">{n}</span>
                <h3 className="t-display-3">{title}</h3>
                <p>{body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </Section>
      <Section>
        <div className="m-split">
          <SectionHeading
            eyebrow="A focused pilot"
            deck="Work with us on one real role. Shape the interview, review what it captures, and calibrate the output with your hiring team."
          >
            Build the process
            <br />
            you would trust.
          </SectionHeading>
          <div className="m-pilot">
            <Eyebrow>{pilot.name}</Eyebrow>
            <h3 className="t-display-3">One role. Shared standards.</h3>
            <ul className="m-features">
              {pilot.features.map((feature) => (
                <FeatureRow key={feature}>{feature}</FeatureRow>
              ))}
            </ul>
            <p className="m-caption">
              Pilot scope and next steps are agreed together. No self-serve
              employer checkout.
            </p>
          </div>
        </div>
      </Section>
      <Section tone="inset" size="md">
        <div className="m-split">
          <SectionHeading eyebrow="Two audiences. Clear boundaries.">
            Practice is personal.
            <br />
            Hiring is separate.
          </SectionHeading>
          <div className="m-prose">
            <p>
              A candidate’s private practice history is not a hiring scorecard.
              Employer screening is a separate, invited experience.
            </p>
            <p>
              The hiring team reviews the evidence and makes the decision. The
              purpose of the interview is to support that judgment.
            </p>
            <Link href="/signup" className="m-inline-link">
              Preparing for your own interview? Start free ↗
            </Link>
          </div>
        </div>
      </Section>
      <CtaBand
        employer
        title="Bring a role. Help shape the round."
        deck="Tell us what your first interview needs to uncover."
      />
    </MarketingLayout>
  );
}
