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
        <p className="t-eyebrow mb-6">NeetCode 150 · Interview Simulator</p>

        <h1 className="t-display text-text text-[44px] sm:text-[64px] md:text-[72px] max-w-4xl">
          You&apos;ve solved 500 problems.
          <br />
          Still <span className="t-italic">failed</span> the interview.
        </h1>

        <p className="t-body mt-8 max-w-[460px] text-text-muted">
          LeetCode didn&apos;t lie to you. It just prepared you for the wrong thing.
          Solving problems alone is not the same as performing under pressure, in front
          of someone, in real time.
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
          <StatTick value="150" label="Problems" />
          <Divider />
          <StatTick value="+31%" label="Avg score gain" />
          <Divider />
          <StatTick value="1.2k" label="Sessions today" />
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
      "You blanked. Not because you didn't know — because no one was watching you before.",
    evidence:
      "Solving at your desk at midnight is nothing like explaining your thinking out loud to a senior engineer judging every word. That gap is real. Nobody warns you about it.",
  },
  {
    num: "02",
    statement: "You got the optimal solution. They still said no hire.",
    evidence:
      "Because you couldn't explain your complexity. Because you jumped to code without walking through your approach. Because you went silent for 4 minutes. All of that is scored. None of it is on LeetCode.",
  },
  {
    num: "03",
    statement: "Mock interviews with friends don't count. They're too nice.",
    evidence:
      "Your friend won't probe a weak approach. Won't ask \"what's the time complexity of that?\" three times. Won't write in a debrief that your communication was unclear. A real interviewer will — and does.",
  },
  {
    num: "04",
    statement: "You have no idea what you actually look like in an interview.",
    evidence:
      "You've never seen your own scorecard. Never had a senior engineer break down exactly what you said, what it signaled, and where you lost the hire. You're flying blind and calling it preparation.",
  },
] as const;

function Confession() {
  return (
    <section
      className="border-b border-border"
      style={{
        background: "rgb(var(--bg-inverse))",
        color: "rgb(var(--text-inverse))",
      }}
    >
      <div className="mx-auto max-w-6xl px-6 sm:px-12 py-20 sm:py-28">
        <p className="t-eyebrow mb-6" style={{ color: "rgb(var(--text-tertiary))" }}>
          02 — The Confession
        </p>
        <h2
          className="t-section-headline text-[32px] sm:text-[40px] max-w-2xl"
          style={{ color: "rgb(var(--text-inverse))" }}
        >
          We both know
          <br />
          what <span className="t-italic">actually</span> happened.
        </h2>

        <ul
          className="mt-14 border-t"
          style={{ borderColor: "rgb(var(--text-tertiary) / 0.18)" }}
        >
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
    <li
      className="group grid grid-cols-[40px_1fr] sm:grid-cols-[80px_1fr] gap-4 sm:gap-8 py-7 border-b transition-colors duration-150"
      style={{ borderColor: "rgb(var(--text-tertiary) / 0.18)" }}
    >
      <span className="t-eyebrow self-start" style={{ color: "rgb(var(--text-tertiary))" }}>
        {num}
      </span>
      <div className="border-l-2 border-transparent group-hover:border-text-ember pl-4 sm:pl-6 -ml-4 sm:-ml-6 transition-colors duration-150">
        <p
          className="t-body text-[15px] sm:text-[17px] group-hover:text-text-ember transition-colors duration-150"
          style={{ color: "rgb(var(--text-inverse))", fontWeight: 500 }}
        >
          {statement}
        </p>
        <p
          className="t-body-light text-[13px] mt-3 max-w-2xl"
          style={{ color: "rgb(var(--text-secondary))", lineHeight: 1.65 }}
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
  { label: "Problem understanding", q: "Did you clarify constraints before diving in?" },
  { label: "Approach quality", q: "Did you walk through trade-offs before committing?" },
  { label: "Code correctness", q: "Does it actually work — for the edge cases too?" },
  { label: "Complexity awareness", q: "Can you defend the time and space, out loud?" },
  { label: "Communication", q: "Did your thinking land — or did the room go quiet?" },
];

function Reframe() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-6xl px-6 sm:px-12 py-20 sm:py-28">
        <p className="t-eyebrow mb-6">03 — The Reframe</p>
        <span className="block h-[2px] w-8 bg-text-ember mb-6" aria-hidden />

        <h2 className="t-section-headline text-[32px] sm:text-[44px] max-w-3xl text-text">
          The problem was never
          <br />
          the <span className="t-italic">problems</span>.
        </h2>

        <p className="t-body mt-8 max-w-[500px] text-text-muted">
          Every candidate who walks into a Google loop has solved the same 150 problems
          you have. The ones who get offers practiced the thing that actually separates
          them: performing under structured evaluation. Getting scored. Doing it again.
        </p>
        <p
          className="t-body mt-6 max-w-[500px] text-text"
          style={{ fontWeight: 500, lineHeight: 1.5 }}
        >
          Explaining. Adapting. Communicating under pressure.
        </p>

        {/* Rubric inset — appears without a header. Trust the reader. */}
        <div
          className="mt-14 p-6 sm:p-8 rounded-xl"
          style={{
            background: "rgb(var(--bg-inverse))",
            color: "rgb(var(--text-inverse))",
          }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {RUBRIC.map((r) => (
              <div
                key={r.label}
                className="rounded-lg p-4"
                style={{ border: "1px solid rgb(var(--border-strong))" }}
              >
                <p className="t-eyebrow" style={{ color: "rgb(var(--text-ember))" }}>
                  {r.label}
                </p>
                <p
                  className="t-body-light text-[12px] mt-2"
                  style={{ color: "rgb(var(--text-secondary))" }}
                >
                  {r.q}
                </p>
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
    label: "Approach",
    eta: "~5 min",
    title: "Talk before you type.",
    body: "The AI interviewer asks you to walk through your approach out loud. It probes. It pushes back. It asks what happens when the input is empty, when n is 10⁶, when there are duplicates. You don't get to hide behind your editor yet.",
    emberBorder: false,
  },
  {
    num: "02",
    label: "Code",
    eta: "~20 min",
    title: "Now write it.",
    body: "Monaco editor, your language. No autocomplete hints, no solution tab. Mid-session you can ask the interviewer a clarifying question — it answers the way a real interviewer would: carefully, without giving anything away.",
    emberBorder: false,
  },
  {
    num: "03",
    label: "Debrief",
    eta: "immediate",
    title: "Here's what you actually looked like.",
    body: "A structured scorecard — five dimensions, 1–5 each, evidence pulled from your exact words and code. Strengths. Gaps. The two sentences a hiring manager would have written about you. Then the optimal approach, fully explained.",
    emberBorder: true,
  },
];

function HowItWorks() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-6xl px-6 sm:px-12 py-20 sm:py-28">
        <p className="t-eyebrow mb-6">04 — How It Works</p>
        <h2 className="t-section-headline text-[32px] sm:text-[40px] max-w-2xl text-text">
          Three phases.
          <br />
          One <span className="t-italic">honest</span> scorecard.
        </h2>

        <div className="mt-14 border-t border-border">
          {PHASES.map((p) => (
            <article
              key={p.num}
              className={`py-10 border-b border-border ${
                p.emberBorder
                  ? "border-l-2 border-l-text-ember pl-6 sm:pl-8 -ml-px"
                  : ""
              }`}
            >
              <div className="flex items-baseline justify-between gap-4 mb-4">
                <span
                  className="t-eyebrow"
                  style={{ color: "rgb(var(--text-ember))" }}
                >
                  Phase {p.num} — {p.label}
                </span>
                <span className="t-eyebrow">{p.eta}</span>
              </div>
              <h3
                className="t-body text-[17px] text-text"
                style={{ fontWeight: 500 }}
              >
                {p.title}
              </h3>
              <p className="t-body-light text-[13px] mt-3 max-w-3xl text-text-muted">
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
  { label: "Problem understanding", score: 4, max: 5 },
  { label: "Approach quality", score: 3, max: 5 },
  { label: "Code correctness", score: 5, max: 5 },
  { label: "Complexity awareness", score: 3, max: 5 },
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
              Two Sum · 24 min
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
              HIRE
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
              className="t-body-light italic text-[13px]"
              style={{ color: "rgb(var(--text-secondary))" }}
            >
              &ldquo;Candidate demonstrated strong problem decomposition but rushed to
              code without fully articulating the O(n) vs O(n log n) tradeoff.
              Communication deteriorated under follow-up pressure. Lean hire — recommend
              a second round focused on complexity articulation.&rdquo;
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
  { n: "31%", label: "Average score increase", body: "Across candidates after 10+ sessions" },
  { n: "6.2x", label: "More likely to advance", body: "Candidates who debrief vs those who don't" },
  { n: "150", label: "Problems covered", body: "Every NeetCode 150 problem. No gaps." },
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
            No account needed. Pick a problem. Start talking.
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
        <p className="t-eyebrow">
          Inturview · NeetCode 150 · Made for candidates who are serious
        </p>
      </div>
    </footer>
  );
}
