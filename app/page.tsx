import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  MessageSquare,
  MoveUpRight,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { TopNav } from "@/components/TopNav";
import { SiteFooter } from "@/components/SiteFooter";
import { ModeArt } from "@/components/dashboard/ModeArt";
import { PracticePreview } from "@/components/landing/PracticePreview";
import { CANDIDATE_PLANS, priceLabel } from "@/lib/plans";

export default async function LandingPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");
  const sprint = CANDIDATE_PLANS.find((plan) => plan.tier === "PRO")!;
  return (
    <>
      <TopNav />
      <main className="marketing">
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <span className="landing-eyebrow">
              <span /> A practice space for your next chapter
            </span>
            <h1>
              You have the
              <br />
              experience.
              <br />
              <em>Find the words.</em>
            </h1>
            <p>
              Walk into your next interview feeling like yourself. Practice with
              an AI interviewer that asks the follow-up, finds the gaps, and
              helps you get better.
            </p>
            <div className="landing-hero-actions">
              <Link href="/signup" className="studio-button studio-button-dark">
                Find your confidence <ArrowUpRight size={17} />
              </Link>
              <a href="#how-it-works" className="landing-secondary-link">
                See how it works <ArrowRight size={16} />
              </a>
            </div>
            <div className="landing-hero-note">
              <Check size={13} /> Free to start <span /> No credit card required
            </div>
          </div>
          <PracticePreview />
        </section>
        <div className="landing-formats">
          <span>
            For every part of
            <br />
            <strong>the conversation.</strong>
          </span>
          <span>
            01 <strong>Recruiter screens</strong>
          </span>
          <span>
            02 <strong>Behavioral stories</strong>
          </span>
          <span>
            03 <strong>Coding rounds</strong>
          </span>
          <span>
            04 <strong>System design</strong>
          </span>
        </div>

        <section className="landing-section landing-rounds" id="rounds">
          <div className="landing-section-heading">
            <div>
              <p className="studio-label">
                Different rounds. One place to grow.
              </p>
              <h2>
                Practice the part
                <br />
                that makes you <em>pause.</em>
              </h2>
            </div>
            <p>
              The career story. The tricky follow-up. The blank editor.
              <br />
              There’s a room for all of it.
            </p>
          </div>
          <div className="landing-round-grid">
            {[
              {
                kind: "screen" as const,
                title: "Tell your story",
                label: "Recruiter screen",
                copy: "Make your experience, motivation, and next move feel connected.",
              },
              {
                kind: "behavioral" as const,
                title: "Make it specific",
                label: "Behavioral",
                copy: "Find the examples that show how you think, act, and learn.",
              },
              {
                kind: "coding" as const,
                title: "Think it through",
                label: "Coding interview",
                copy: "Work through the problem, explain your approach, and write the code.",
              },
              {
                kind: "design" as const,
                title: "See the bigger picture",
                label: "System design",
                copy: "Explore the trade-offs and sketch a system that holds up.",
              },
            ].map((round) => (
              <Link
                href="/signup"
                key={round.kind}
                className={`landing-round practice-card-${round.kind}`}
              >
                <div className="practice-card-art">
                  <ModeArt kind={round.kind} />
                </div>
                <div className="landing-round-copy">
                  <span className="studio-label">{round.label}</span>
                  <h3>{round.title}</h3>
                  <p>{round.copy}</p>
                  <span className="mode-cta">
                    Step into the room <ArrowUpRight size={15} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="landing-followup">
          <div className="landing-followup-inner">
            <div>
              <p className="studio-label">The question after the question</p>
              <h2>
                A good interviewer
                <br />
                doesn’t just <em>nod along.</em>
              </h2>
              <p>
                “We shipped it” is a start. What did you do? What changed? What
                would you do differently? Practice getting to the answers that
                actually say something about you.
              </p>
              <Link href="/signup" className="landing-inverse-link">
                Get past your first answer <ArrowUpRight size={17} />
              </Link>
            </div>
            <div className="followup-example">
              <span className="studio-label">
                An example of going a little deeper
              </span>
              <div className="followup-quote">
                “We improved the onboarding experience.”
              </div>
              <div className="followup-connector" aria-hidden="true" />
              <div className="followup-response">
                <MessageSquare size={21} />
                <p>
                  What did <em>you</em> change,
                  <br />
                  and how did you know it worked?
                </p>
              </div>
              <span className="followup-annotation">
                The useful part starts here. <MoveUpRight size={18} />
              </span>
            </div>
          </div>
        </section>

        <section className="landing-section" id="how-it-works">
          <div className="landing-section-heading">
            <div>
              <p className="studio-label">A simple loop. A stronger you.</p>
              <h2>
                Rehearse. Reflect.
                <br />
                <em>Go again.</em>
              </h2>
            </div>
            <p>
              No scheduling. No audience.
              <br />
              Just a little space to get better.
            </p>
          </div>
          <div className="landing-steps">
            {[
              {
                n: "01",
                title: "Choose your room.",
                copy: "Start with the round on your mind. Work on your career story, a behavioral example, code, or system design.",
              },
              {
                n: "02",
                title: "Have the conversation.",
                copy: "Answer in your own words. Your AI interviewer asks follow-ups and gives you space to work through the hard parts.",
              },
              {
                n: "03",
                title: "Take something with you.",
                copy: "Get a structured debrief with strengths, gaps, and specific changes to try. Come back and put them into practice.",
              },
            ].map((step) => (
              <article key={step.n}>
                <span className="step-number">{step.n}</span>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section landing-debrief">
          <div className="debrief-example">
            <div className="debrief-example-header">
              <span className="studio-label">
                Recruiter screen · Example debrief
              </span>
              <span className="debrief-verdict">
                <Check size={12} /> Advance
              </span>
            </div>
            <div className="debrief-example-score">
              <span>
                18<small>/25</small>
              </span>
              <div>
                A clear story.
                <br />
                <strong>Room to make it yours.</strong>
              </div>
            </div>
            <div className="debrief-score-rows">
              {[
                { label: "Story clarity", score: 4 },
                { label: "Motivation", score: 3 },
                { label: "Role alignment", score: 4 },
                { label: "Compensation", score: 3 },
                { label: "Communication", score: 4 },
              ].map((row) => (
                <div key={row.label}>
                  <span>{row.label}</span>
                  <div>
                    {Array.from({ length: 5 }, (_, i) => (
                      <i key={i} className={i < row.score ? "is-filled" : ""} />
                    ))}
                  </div>
                  <strong>
                    {row.score}
                    <small>/5</small>
                  </strong>
                </div>
              ))}
            </div>
            <div className="debrief-takeaway">
              <span className="studio-label">Something to work on</span>
              <p>
                Your timeline is clear. Connect your next move to something
                specific about the role.
              </p>
            </div>
          </div>
          <div className="landing-debrief-copy">
            <p className="studio-label">Progress you can put your finger on</p>
            <h2>
              Leave with more
              <br />
              than a <em>feeling.</em>
            </h2>
            <p>
              Know what came through and what stayed vague. Every completed
              round gives you a scorecard, specific feedback, and a place in
              your interview history.
            </p>
            <ul>
              <li>
                <Check size={15} /> Evidence behind the evaluation
              </li>
              <li>
                <Check size={15} /> Clear strengths and things to sharpen
              </li>
              <li>
                <Check size={15} /> Your practice history, all in one place
              </li>
            </ul>
            <Link href="/signup" className="studio-text-link">
              Get your first debrief <ArrowUpRight size={16} />
            </Link>
          </div>
        </section>

        <section className="landing-section landing-faq">
          <div>
            <p className="studio-label">Before you step inside</p>
            <h2>
              A few good
              <br />
              <em>questions.</em>
            </h2>
          </div>
          <div>
            {[
              {
                q: "Can I try it for free?",
                a: "Yes. Create a free account to practice recruiter screens, behavioral answers, coding, and system design. Your free plan includes monthly session limits and full debriefs.",
              },
              {
                q: "Are the interviews voice or text?",
                a: "The core practice rounds are text based, with a code editor for coding and a whiteboard for system design. Face-to-face voice and video practice is being developed separately.",
              },
              {
                q: "What if I want to practice more?",
                a: `Interview Sprint gives you 30 days of unlimited recruiter, behavioral, coding, and system-design practice for ${priceLabel(sprint)}. It’s a one-time payment. Buy another pass whenever you want to extend your access.`,
              },
              {
                q: "Will this guarantee me a job?",
                a: "No. Inturview gives you a place to rehearse and feedback to work with. AI scores are practice feedback, not a prediction of a hiring decision.",
              },
            ].map((item) => (
              <details key={item.q}>
                <summary>
                  {item.q}
                  <ChevronDown size={16} />
                </summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="landing-final">
          <div className="landing-final-decoration" aria-hidden="true">
            ↗
          </div>
          <p className="studio-label">You don’t have to wing it.</p>
          <h2>
            Meet your next opportunity
            <br />
            with a little more <em>you.</em>
          </h2>
          <p>One practice round can be a good place to start.</p>
          <Link href="/signup" className="studio-button studio-button-dark">
            Step into your practice room <ArrowUpRight size={18} />
          </Link>
          <span>Free to start. Ready when you are.</span>
        </section>
        <SiteFooter />
      </main>
    </>
  );
}
