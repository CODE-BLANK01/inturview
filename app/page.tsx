import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { TopNav } from "@/components/TopNav";

/* ===========================================================================
 * inturview — landing page
 *
 * Strict rules from the brand brief:
 *   1. Left-aligned by default. Center only in Section 06 and footer.
 *   2. No icons, no illustrations, no shadows.
 *   3. Border-radius: 8px buttons, 12px cards. Never more.
 *   4. Ember (text-ember) touches exactly THREE things per viewport:
 *        - the Instrument Serif italic word in the headline
 *        - the Phase 03 left-border (in How It Works)
 *        - the active fill of score bars (in The Scorecard)
 *   5. Hover states are color transitions only (150ms). No motion.
 *   6. The blankness of the parchment IS the design.
 * ========================================================================= */

export default async function LandingPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <>
      <TopNav />
      <main>
        <Hero />
        <Confession />
        <Reframe />
        <HowItWorks />
        <ScorecardPreview />
        <Outcome />
        <Footer />
      </main>
    </>
  );
}

/* --------------------------------------------------------------------------
 * 01 — Hero
 * ------------------------------------------------------------------------ */

function Hero() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-6xl px-6 sm:px-12 py-20 sm:py-28">
        <p className="t-eyebrow mb-6">Recruiter screens · Behavioral interviews · Technical rounds</p>

        <h1 className="t-display text-text text-[44px] sm:text-[64px] md:text-[72px] max-w-4xl">
          You know your experience.
          <br />
          Can you <span className="t-italic">tell</span> the story?
        </h1>

        <p className="t-body mt-8 max-w-[460px] text-text-muted">
          The first screen can turn on a simple question: “Tell me about yourself.”
          Practice your story, motivation, and behavioral examples with an AI
          interviewer that asks follow-ups and gives you a structured debrief.
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link href="/signup" className="btn btn-primary px-5 py-3 text-[14px]">
            Start your first session
            <span aria-hidden>↗</span>
          </Link>
          <Link href="/signin" className="btn btn-ghost px-5 py-3 text-[14px]">
            I have an account
          </Link>
        </div>

        <div className="mt-12 h-px w-full bg-border" aria-hidden />

        <ul className="mt-8 flex flex-wrap gap-8 sm:gap-12">
          <StatTick value="01" label="Recruiter screen" />
          <Divider />
          <StatTick value="02" label="Behavioral" />
          <Divider />
          <StatTick value="03–04" label="Coding + design" />
        </ul>
      </div>
    </section>
  );
}

function StatTick({ value, label }: { value: string; label: string }) {
  return (
    <li className="flex flex-col">
      <span className="t-display text-[22px] text-text leading-none">{value}</span>
      <span className="t-eyebrow mt-2">{label}</span>
    </li>
  );
}

function Divider() {
  return <li className="hidden sm:block h-10 w-px bg-border self-center" aria-hidden />;
}

/* --------------------------------------------------------------------------
 * 02 — The Confession   (dark inverse section)
 * ------------------------------------------------------------------------ */

const CONFESSIONS = [
  {
    num: "01",
    statement:
      "Tell me about yourself. Suddenly your clear career path sounds like a list of job titles.",
    evidence:
      "A recruiter needs to understand what you did, why you moved, and what you want next. It is hard to find that story for the first time in a live screen.",
  },
  {
    num: "02",
    statement: "Your behavioral example had a result. The interviewer still asked what you actually did.",
    evidence:
      "“We shipped it” hides your contribution. Strong examples make the situation, your actions, the outcome, and what you learned clear.",
  },
  {
    num: "03",
    statement: "A friend may nod along where an interviewer would probe.",
    evidence:
      "A useful practice round asks what changed, how you measured impact, and why this role makes sense for you. The follow-up is often where the real answer appears.",
  },
  {
    num: "04",
    statement: "You finish a practice answer without knowing what landed.",
    evidence:
      "A debrief can show whether your story was clear, your motivation was specific, and your answer had enough evidence to carry into the next round.",
  },
] as const;

function Confession() {
  return (
    <section className="surface-inverse border-b border-border">
      <div className="mx-auto max-w-6xl px-6 sm:px-12 py-20 sm:py-28">
        <p className="t-eyebrow mb-6">02 — The Confession</p>
        <h2 className="t-section-headline text-[32px] sm:text-[40px] max-w-2xl text-text-inverse">
          We both know
          <br />
          what <span className="t-italic">actually</span> happened.
        </h2>

        <ul className="mt-14 border-t border-text-dim/18">
          {CONFESSIONS.map((c) => (
            <ConfessionRow key={c.num} {...c} />
          ))}
        </ul>
      </div>
    </section>
  );
}

function ConfessionRow({
  num,
  statement,
  evidence,
}: {
  num: string;
  statement: string;
  evidence: string;
}) {
  return (
    <li className="group grid grid-cols-[40px_1fr] sm:grid-cols-[80px_1fr] gap-4 sm:gap-8 py-7 border-b border-text-dim/18 transition-colors duration-150">
      <span className="t-eyebrow self-start">{num}</span>
      <div className="border-l-2 border-transparent group-hover:border-text-ember pl-4 sm:pl-6 -ml-4 sm:-ml-6 transition-colors duration-150">
        <p
          className="t-body text-[15px] sm:text-[17px] text-text-inverse group-hover:text-text-ember transition-colors duration-150"
          style={{ fontWeight: 500 }}
        >
          {statement}
        </p>
        <p
          className="t-body-light text-[15px] mt-3 max-w-2xl text-text-muted"
          style={{ lineHeight: 1.65 }}
        >
          {evidence}
        </p>
      </div>
    </li>
  );
}

/* --------------------------------------------------------------------------
 * 03 — The Reframe
 * ------------------------------------------------------------------------ */

const RUBRIC = [
  { label: "Story clarity", q: "Can someone follow your career path and transitions?" },
  { label: "Motivation", q: "Is your reason for this move specific and credible?" },
  { label: "Role alignment", q: "Can you connect your experience to this role?" },
  { label: "Compensation", q: "Can you discuss expectations clearly?" },
  { label: "Communication", q: "Did your answers feel concise and two-way?" },
];

function Reframe() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-6xl px-6 sm:px-12 py-20 sm:py-28">
        <p className="t-eyebrow mb-6">03 — The Reframe</p>
        <span className="block h-[2px] w-8 bg-text-ember mb-6" aria-hidden />

        <h2 className="t-section-headline text-[32px] sm:text-[44px] max-w-3xl text-text">
          The first round is
          <br />
          more than a <span className="t-italic">formality</span>.
        </h2>

        <p className="t-body mt-8 max-w-[500px] text-text-muted">
          A recruiter screen asks for your story, your motivation, and your expectations.
          A behavioral round asks you to prove the claims in that story with specific
          examples. Both are skills you can practice before the real conversation.
        </p>
        <p
          className="t-body mt-6 max-w-[500px] text-text"
          style={{ fontWeight: 500, lineHeight: 1.5 }}
        >
          Try an answer. Hear the follow-up. See what to sharpen.
        </p>

        {/* Rubric inset — appears without a header. Trust the reader. */}
        <div className="surface-inverse mt-14 p-6 sm:p-8 rounded-xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {RUBRIC.map((r) => (
              <div
                key={r.label}
                className="rounded-lg p-4"
                style={{ border: "1px solid rgb(var(--border-strong))" }}
              >
                <p className="t-eyebrow text-text-ember">{r.label}</p>
                <p className="t-body-light text-[15px] mt-2 text-text-muted">{r.q}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------
 * 04 — How It Works
 * ------------------------------------------------------------------------ */

const PHASES = [
  {
    num: "01",
    label: "Choose",
    eta: "your round",
    title: "Start with the conversation you need most.",
    body: "Try a recruiter screen for your career story and role fit, or pick a behavioral question to work on a specific example. Coding and system design are there when you need them.",
    emberBorder: false,
  },
  {
    num: "02",
    label: "Practice",
    eta: "at your pace",
    title: "Answer, then handle the follow-up.",
    body: "The text-based AI interviewer asks for specifics and keeps the conversation moving. Practice explaining decisions and results without a script in front of you.",
    emberBorder: false,
  },
  {
    num: "03",
    label: "Debrief",
    eta: "immediate",
    title: "Here's what you actually looked like.",
    body: "Get a structured scorecard for that round: what came through, what stayed vague, and what to improve before the next attempt.",
    emberBorder: true,
  },
];

function HowItWorks() {
  return (
    <section className="surface-inverse border-b border-border">
      <div className="mx-auto max-w-6xl px-6 sm:px-12 py-20 sm:py-28">
        <p className="t-eyebrow mb-6">04 — How It Works</p>
        <h2 className="t-section-headline text-[32px] sm:text-[40px] max-w-2xl text-text-inverse">
          Pick a round.
          <br />
          Get an <span className="t-italic">honest</span> debrief.
        </h2>

        <div className="mt-14 border-t border-text-dim/18">
          {PHASES.map((p) => (
            <article
              key={p.num}
              className={`py-10 border-b border-text-dim/18 ${
                p.emberBorder
                  ? "border-l-2 border-l-text-ember pl-6 sm:pl-8 -ml-px"
                  : ""
              }`}
            >
              <div className="flex items-baseline justify-between gap-4 mb-4">
                <span className="t-eyebrow text-text-ember">
                  Step {p.num} — {p.label}
                </span>
                <span className="t-eyebrow">{p.eta}</span>
              </div>
              <h3
                className="t-body text-[17px] text-text-inverse"
                style={{ fontWeight: 500 }}
              >
                {p.title}
              </h3>
              <p className="t-body-light text-[15px] mt-3 max-w-3xl text-text-muted">
                {p.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------
 * 05 — The Scorecard
 * ------------------------------------------------------------------------ */

const SCORE_ROWS = [
  { label: "Story clarity", score: 4, max: 5 },
  { label: "Motivation fit", score: 3, max: 5 },
  { label: "Compensation", score: 3, max: 5 },
  { label: "Role alignment", score: 4, max: 5 },
  { label: "Communication", score: 4, max: 5 },
];

function ScorecardPreview() {
  const total = SCORE_ROWS.reduce((s, r) => s + r.score, 0);
  const max = SCORE_ROWS.reduce((s, r) => s + r.max, 0);
  return (
    <section
      className="border-b border-border"
      style={{ background: "rgb(var(--bg-inset) / 0.4)" }}
    >
      <div className="mx-auto max-w-6xl px-6 sm:px-12 py-20 sm:py-28">
        <p className="t-eyebrow mb-6">05 — The Scorecard</p>
        <h2 className="t-section-headline text-[32px] sm:text-[40px] max-w-3xl text-text">
          This is what you&apos;ve been
          <br />
          missing <span className="t-italic">after</span> every session.
        </h2>

        <div className="mt-14 max-w-2xl panel p-6 sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <h3 className="t-body text-[15px] text-text" style={{ fontWeight: 500 }}>
              Recruiter screen · example debrief
            </h3>
            <span
              className="badge"
              style={{
                background: "rgb(var(--score-hire-bg))",
                color: "rgb(var(--score-hire))",
                borderColor: "rgb(var(--score-hire) / 0.35)",
                fontWeight: 700,
              }}
            >
              ADVANCE
            </span>
            <span className="t-data text-[22px] text-text whitespace-nowrap">
              {total} / {max}
            </span>
          </div>

          <ul className="mt-8 space-y-4">
            {SCORE_ROWS.map((r) => (
              <li
                key={r.label}
                className="grid grid-cols-[120px_1fr_44px] sm:grid-cols-[170px_1fr_56px] items-center gap-4"
              >
                <span className="t-eyebrow truncate">{r.label}</span>
                <div
                  className="h-[4px] w-full overflow-hidden"
                  style={{ background: "rgb(var(--border-base))", borderRadius: "2px" }}
                >
                  <div
                    className="h-full"
                    style={{
                      width: `${(r.score / r.max) * 100}%`,
                      background: "rgb(var(--text-ember))",
                      borderRadius: "2px",
                    }}
                  />
                </div>
                <span className="t-data text-[12px] text-text text-right">
                  {r.score} / {r.max}
                </span>
              </li>
            ))}
          </ul>

          <blockquote
            className="mt-8 pl-4 border-l-2"
            style={{ borderColor: "rgb(var(--text-ember))" }}
          >
            <p
              className="t-body-light italic text-[15px]"
              style={{ color: "rgb(var(--text-secondary))" }}
            >
              &ldquo;The candidate gave a clear career timeline and specific examples of
              impact. Their reason for this role needs more detail, and their compensation
              range could be stated more directly.&rdquo;
            </p>
          </blockquote>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------
 * 06 — The Outcome  (only centered section)
 * ------------------------------------------------------------------------ */

const OUTCOMES = [
  { n: "01", label: "Recruiter screen", body: "Practice your story, motivation, and expectations." },
  { n: "02", label: "Behavioral", body: "Build stronger examples with real follow-ups." },
  { n: "03–04", label: "Technical rounds", body: "Keep coding and system design in the same practice loop." },
];

function Outcome() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-5xl px-6 sm:px-12 py-24 sm:py-32 text-center">
        <p className="t-eyebrow mb-6 inline-block">06 — The Outcome</p>
        <h2
          className="t-display text-text text-[40px] sm:text-[52px] mx-auto max-w-3xl"
          style={{ lineHeight: 0.95 }}
        >
          Practice like it&apos;s real.
          <br />
          Until real feels like
          <br />
          practice.
        </h2>

        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-12 max-w-3xl mx-auto">
          {OUTCOMES.map((o) => (
            <div key={o.label}>
              <div className="t-display text-[40px] sm:text-[48px] text-text leading-none">
                {o.n}
              </div>
              <div className="t-eyebrow mt-3">{o.label}</div>
              <p
                className="t-body-light text-[13px] mt-3 mx-auto max-w-[220px]"
                style={{ color: "rgb(var(--text-secondary))" }}
              >
                {o.body}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-20">
          <p
            className="t-body-light text-[16px] mb-6"
            style={{ color: "rgb(var(--text-secondary))" }}
          >
            Create a free account, choose a round, and start practicing.
          </p>
          <Link href="/signup" className="btn btn-primary text-[15px] px-8 py-4">
            Start your first session
            <span aria-hidden>↗</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------
 * 07 — Footer
 * ------------------------------------------------------------------------ */

function Footer() {
  return (
    <footer>
      <div className="mx-auto max-w-6xl px-6 sm:px-12 py-10 text-center">
        <nav className="mb-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          <Link
            href="/about"
            className="t-eyebrow text-text-dim hover:text-text transition-colors duration-150"
          >
            About
          </Link>
          <Link
            href="/pricing"
            className="t-eyebrow text-text-dim hover:text-text transition-colors duration-150"
          >
            Pricing
          </Link>
          <Link
            href="/employers"
            className="t-eyebrow text-text-dim hover:text-text transition-colors duration-150"
          >
            For employers
          </Link>
          <Link
            href="/contact"
            className="t-eyebrow text-text-dim hover:text-text transition-colors duration-150"
          >
            Contact
          </Link>
        </nav>
        <p className="t-eyebrow">
          Inturview · Practice the conversations that decide the next round
        </p>
      </div>
    </footer>
  );
}
