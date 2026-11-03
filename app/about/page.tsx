import {
  MarketingLayout,
  Section,
  SectionHeading,
  Cta,
  CtaBand,
  Eyebrow,
  Reveal,
} from "@/components/marketing";
export const metadata = {
  title: "About — inturview",
  description:
    "A place to practice the performance of an interview, get honest feedback, and go again.",
};
const BELIEFS = [
  {
    num: "01",
    title: "Performance beats memorization.",
    body: "Knowing the optimal solution is not the same as walking an interviewer through your thinking, defending trade-offs, and staying composed when they push back. We train the performance — not just the answer.",
  },
  {
    num: "02",
    title: "Honest feedback beats encouragement.",
    body: "Friends are too nice. Real interviewers are not. Every session ends with a structured scorecard — strengths, gaps, and the two sentences a hiring manager would actually write.",
  },
  {
    num: "03",
    title: "Repetition under pressure builds confidence.",
    body: "The gap between your desk at midnight and a senior engineer watching you think is real. Closing it takes reps. We built a place to get those reps without burning a referral or a recruiter's time.",
  },
];
export default function AboutPage() {
  return (
    <MarketingLayout>
      <Section>
        <Reveal hero>
          <SectionHeading
            as="h1"
            eyebrow="Our point of view"
            deck="You can know the work and still struggle to explain it in an interview. That gap deserves a better place to practice."
          >
            We built the practice
            <br />
            we couldn’t <em className="t-italic">find.</em>
          </SectionHeading>
          <div className="m-actions">
            <Cta />
            <Cta href="/pricing" secondary>
              See pricing
            </Cta>
          </div>
        </Reveal>
      </Section>
      <Section tone="inverse">
        <div className="m-split">
          <SectionHeading eyebrow="Why we are here">
            Knowing it
            <br />
            is half the work.
          </SectionHeading>
          <div className="m-prose">
            <p>
              We kept seeing the same pattern: engineers who could solve the
              problem, then go quiet when asked to explain their approach.
              Strong candidates whose examples never quite showed the impact of
              their work.
            </p>
            <p>
              More questions were not the missing piece. The missing piece was
              the follow-up. The silence while you think. A debrief that shows
              where your answer fell short.
            </p>
            <p className="m-prose-emphasis">
              Inturview exists to make that practice available before the
              conversation counts.
            </p>
          </div>
        </div>
      </Section>
      {BELIEFS.map((belief, i) => (
        <Section key={belief.num} tone={i === 1 ? "inset" : "page"}>
          <Reveal>
            <div className="m-belief">
              <Eyebrow>{belief.num} / What we believe</Eyebrow>
              <div>
                <h2 className="t-display-2">{belief.title}</h2>
                <p className="m-deck">{belief.body}</p>
              </div>
            </div>
          </Reveal>
        </Section>
      ))}
      <CtaBand
        title="Confidence needs somewhere to start."
        deck="One round. Honest feedback. A clearer idea of what to try next."
      />
    </MarketingLayout>
  );
}
