import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { PracticePreview } from "@/components/landing/PracticePreview";
import {
  MarketingLayout,
  Section,
  SectionHeading,
  Eyebrow,
  Cta,
  CtaBand,
  Reveal,
  Stat,
  FeatureRow,
} from "@/components/marketing";
import { CANDIDATE_PLANS, priceLabel, priceSuffix } from "@/lib/plans";
import {
  ArrowDown,
  MessagesSquare,
  Code2,
  Network,
  ScanLine,
} from "lucide-react";

const modes = [
  {
    n: "01",
    name: "Recruiter screen",
    title: "Make your story land.",
    body: "Connect your experience, your motivation, and what comes next.",
    icon: ScanLine,
  },
  {
    n: "02",
    name: "Behavioral",
    title: "Put substance behind it.",
    body: "Turn “we did it” into a clear account of your decisions and impact.",
    icon: MessagesSquare,
  },
  {
    n: "03",
    name: "Coding",
    title: "Show your thinking.",
    body: "Explain the approach, write the code, and work through the edge cases.",
    icon: Code2,
  },
  {
    n: "04",
    name: "System design",
    title: "Defend the trade-offs.",
    body: "Scope the problem. Sketch the system. Explain why it holds up.",
    icon: Network,
  },
];

export default async function LandingPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");
  const sprint = CANDIDATE_PLANS.find((plan) => plan.tier === "PRO")!;
  return (
    <MarketingLayout>
      <Section className="m-home-hero">
        <div className="m-hero-grid">
          <Reveal hero className="m-hero-copy">
            <SectionHeading
              as="h1"
              eyebrow="Your next chapter starts here"
              deck="An AI interviewer that goes beyond the first answer. Work through the nerves, find your gaps, and walk in sounding like yourself."
            >
              You have the
              <br />
              experience.
              <br />
              <em className="t-italic">Find the words.</em>
            </SectionHeading>
            <div className="m-actions m-hero-actions">
              <Cta />
              <Cta href="/pricing" secondary>
                See pricing
              </Cta>
            </div>
            <p className="m-caption m-hero-note">
              Free to start. No credit card required.
            </p>
          </Reveal>
          <Reveal hero delay={0.06} className="m-hero-demo">
            <PracticePreview />
          </Reveal>
        </div>
        <div className="m-hero-bottom">
          <p>
            Less rehearsed. <strong>Better prepared.</strong>
          </p>
          <a href="#practice">
            Find your starting point <ArrowDown size={16} aria-hidden="true" />
          </a>
        </div>
      </Section>
      <Section id="practice" tone="inset">
        <Reveal>
          <SectionHeading
            eyebrow="01 / Find your starting point"
            deck="The career story. The tricky follow-up. The blank editor. Work on the round that needs your attention."
          >
            Practice the part
            <br />
            that makes you pause.
          </SectionHeading>
        </Reveal>
        <div className="m-mode-grid">
          {modes.map(({ n, name, title, body, icon: Icon }, i) => (
            <Reveal key={n} delay={i * 0.06}>
              <article className="m-mode">
                <div className="m-mode-top">
                  <span className="t-eyebrow">
                    {n} / {name}
                  </span>
                  <Icon size={23} strokeWidth={1.4} aria-hidden="true" />
                </div>
                <h3 className="t-display-3">{title}</h3>
                <p>{body}</p>
              </article>
            </Reveal>
          ))}
        </div>
        <p className="m-caption m-section-note">
          Text-based rounds. A code editor for coding. A whiteboard for system
          design.
        </p>
      </Section>
      <Section id="how-it-works" tone="inverse">
        <Reveal>
          <SectionHeading
            eyebrow="02 / A useful kind of repetition"
            deck="No scheduling. No audience. Just a focused conversation, followed by something you can work on."
          >
            Rehearse. Reflect.
            <br />
            Go again.
          </SectionHeading>
        </Reveal>
        <div className="m-step-grid">
          {[
            [
              "01",
              "Choose your round.",
              "Start with what is ahead of you: a first screen, a story to sharpen, or a technical challenge.",
            ],
            [
              "02",
              "Go past the first answer.",
              "Your interviewer asks follow-ups. Explain your decisions and find where your reasoning gets thin.",
            ],
            [
              "03",
              "Take the feedback with you.",
              "Read the scorecard. Pick a specific improvement. Put it into practice in your next round.",
            ],
          ].map(([n, title, body], i) => (
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
          <Reveal>
            <SectionHeading
              eyebrow="03 / The outcome"
              deck="Know what came through and what stayed vague. Every completed round gives you specific feedback and a place in your interview history."
            >
              Leave with more
              <br />
              than a feeling.
            </SectionHeading>
            <ul className="m-features">
              <FeatureRow>Evidence behind the evaluation</FeatureRow>
              <FeatureRow>Clear strengths and specific next steps</FeatureRow>
              <FeatureRow>Your practice history, all in one place</FeatureRow>
            </ul>
            <p className="m-caption">
              AI feedback is for practice, not a prediction of a hiring
              decision.
            </p>
          </Reveal>
          <Reveal delay={0.06}>
            <article className="m-scorecard">
              <div className="m-card-heading">
                <Eyebrow>Example debrief / Recruiter screen</Eyebrow>
                <span className="m-neutral-badge">Illustrative</span>
              </div>
              <div className="m-score">
                <strong className="t-display-1">
                  18<span>/25</span>
                </strong>
                <p>
                  A clear story.
                  <br />
                  <strong>Make the impact yours.</strong>
                </p>
              </div>
              {[
                ["Story clarity", 4],
                ["Motivation", 3],
                ["Role alignment", 4],
                ["Compensation", 3],
                ["Communication", 4],
              ].map(([label, score]) => (
                <div className="m-score-row" key={label}>
                  <span>{label}</span>
                  <div aria-hidden="true">
                    {Array.from({ length: 5 }, (_, i) => (
                      <i
                        key={i}
                        className={i < Number(score) ? "filled" : ""}
                      />
                    ))}
                  </div>
                  <span>{score}/5</span>
                </div>
              ))}
              <div className="m-score-note">
                <Eyebrow>Your next rep</Eyebrow>
                <p>
                  Your timeline is clear. Connect your next move to something
                  specific about the role.
                </p>
              </div>
            </article>
          </Reveal>
        </div>
      </Section>
      <Section tone="inset" size="md">
        <div className="m-price-teaser">
          <SectionHeading
            eyebrow="Practice on your terms"
            deck="Start free. When your interview gets close, give yourself room to repeat the rounds that matter."
          >
            A sprint.
            <br />
            Not a subscription.
          </SectionHeading>
          <div>
            <Stat value={priceLabel(sprint)} label={priceSuffix(sprint)} />
            <p className="m-muted">
              {sprint.name}. One payment.
              <br />
              Extend whenever you need more time.
            </p>
            <Cta href="/pricing" secondary>
              See pricing
            </Cta>
          </div>
        </div>
      </Section>
      <CtaBand
        title="Meet the moment. With practice."
        deck="You have the experience. Give yourself a place to bring it out."
      />
    </MarketingLayout>
  );
}
