import Link from "next/link";
import { TopNav } from "@/components/TopNav";

export const metadata = {
  title: "About — inturview",
  description:
    "Why we built inturview — an AI interview simulator for engineers who want honest practice, structured feedback, and real performance under pressure.",
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
] as const;

const MODES = [
  {
    label: "Coding",
    body: "NeetCode 150 problems in a three-phase loop — approach, code, debrief. The AI probes your reasoning before you touch the editor.",
  },
  {
    label: "System design",
    body: "Scope a problem on a whiteboard, walk through trade-offs, and get scored on the dimensions that actually matter in a design interview.",
  },
  {
    label: "Behavioral",
    body: "STAR-format drills against real interviewer questions — conflict, ambiguity, influence, failure. Scored on clarity, not charm.",
  },
  {
    label: "Recruiter screen",
    body: "A 25-minute phone screen simulation — your story, your motivation, your comp expectations. The awkward parts included.",
  },
] as const;

export default function AboutPage() {
  return (
    <>
      <TopNav />
      <main>
        <AboutHero />
        <Origin />
        <Beliefs />
        <WhatWeBuilt />
        <AboutCta />
        <AboutFooter />
      </main>
    </>
  );
}

function AboutHero() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-6xl px-6 sm:px-12 py-20 sm:py-28">
        <p className="t-eyebrow mb-6">About</p>

        <h1 className="t-display text-text text-[40px] sm:text-[56px] md:text-[64px] max-w-3xl">
          We built the interview practice
          <br />
          we couldn&apos;t <span className="t-italic">find</span>.
        </h1>

        <p className="t-body mt-8 max-w-[520px] text-text-muted">
          inturview is an AI interview simulator for software engineers preparing for
          real loops. Not another problem bank — a place to perform under structured
          evaluation, get scored on how you actually show up, and do it again until
          real interviews stop feeling like a surprise.
        </p>
      </div>
    </section>
  );
}

function Origin() {
  return (
    <section className="surface-inverse border-b border-border">
      <div className="mx-auto max-w-6xl px-6 sm:px-12 py-20 sm:py-28">
        <p className="t-eyebrow mb-6">Why this exists</p>
        <h2 className="t-section-headline text-[32px] sm:text-[40px] max-w-2xl text-text-inverse">
          The gap nobody
          <br />
          warns you <span className="t-italic">about</span>.
        </h2>

        <div className="mt-10 max-w-2xl space-y-6">
          <p className="t-body text-[15px] text-text-muted">
            We kept seeing the same pattern: engineers who could solve any problem on
            LeetCode, then go silent when asked to explain their approach out loud.
            Candidates who nailed the optimal solution and still got a no-hire — because
            they couldn&apos;t articulate complexity, skipped the walkthrough, or lost
            composure under follow-up pressure.
          </p>
          <p className="t-body text-[15px] text-text-muted">
            Mock interviews with friends helped a little. They were too nice. Too
            forgiving. Nobody wrote a debrief. Nobody scored communication on a rubric.
            Nobody simulated what it feels like when the room goes quiet and you realize
            you&apos;ve been coding for four minutes without saying a word.
          </p>
          <p
            className="t-body text-[15px] text-text-inverse"
            style={{ fontWeight: 500, lineHeight: 1.5 }}
          >
            inturview exists to close that gap — with practice that feels real and
            feedback that tells the truth.
          </p>
        </div>
      </div>
    </section>
  );
}

function Beliefs() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-6xl px-6 sm:px-12 py-20 sm:py-28">
        <p className="t-eyebrow mb-6">What we believe</p>
        <span className="block h-[2px] w-8 bg-text-ember mb-6" aria-hidden />

        <h2 className="t-section-headline text-[32px] sm:text-[40px] max-w-2xl text-text">
          Three convictions.
          <br />
          One <span className="t-italic">standard</span>.
        </h2>

        <ul className="mt-14 border-t border-border">
          {BELIEFS.map((b) => (
            <li
              key={b.num}
              className="grid grid-cols-[40px_1fr] sm:grid-cols-[80px_1fr] gap-4 sm:gap-8 py-8 border-b border-border"
            >
              <span className="t-eyebrow self-start">{b.num}</span>
              <div>
                <p
                  className="t-body text-[15px] sm:text-[17px] text-text"
                  style={{ fontWeight: 500 }}
                >
                  {b.title}
                </p>
                <p className="t-body-light text-[15px] mt-3 max-w-2xl text-text-muted">
                  {b.body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function WhatWeBuilt() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-6xl px-6 sm:px-12 py-20 sm:py-28">
        <p className="t-eyebrow mb-6">What we built</p>
        <h2 className="t-section-headline text-[32px] sm:text-[40px] max-w-2xl text-text">
          Four ways to practice.
          <br />
          One honest <span className="t-italic">scorecard</span>.
        </h2>

        <p className="t-body mt-8 max-w-[500px] text-text-muted">
          Every mode follows the same philosophy: simulate the real thing, evaluate
          against a rubric, and give you evidence — not vibes — so you know exactly
          what to fix before your next loop.
        </p>

        <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 gap-px bg-border border border-border rounded-xl overflow-hidden">
          {MODES.map((m) => (
            <div key={m.label} className="bg-bg p-6 sm:p-8">
              <p className="t-eyebrow text-text-ember">{m.label}</p>
              <p className="t-body-light text-[15px] mt-3 text-text-muted">{m.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AboutCta() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-5xl px-6 sm:px-12 py-24 sm:py-32 text-center">
        <p className="t-eyebrow mb-6 inline-block">Ready when you are</p>
        <h2
          className="t-display text-text text-[36px] sm:text-[48px] mx-auto max-w-2xl"
          style={{ lineHeight: 0.95 }}
        >
          Serious preparation
          <br />
          deserves serious <span className="t-italic">practice</span>.
        </h2>

        <p className="t-body-light text-[16px] mt-8 mb-8 mx-auto max-w-md text-text-muted">
          Pick a problem. Start talking. See what you actually look like in an
          interview — before it counts.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/signup" className="btn btn-primary text-[15px] px-8 py-4">
            Start your first session
            <span aria-hidden>↗</span>
          </Link>
          <Link href="/" className="btn btn-ghost text-[15px] px-8 py-4">
            Back to home
          </Link>
        </div>
      </div>
    </section>
  );
}

function AboutFooter() {
  return (
    <footer>
      <div className="mx-auto max-w-6xl px-6 sm:px-12 py-10 text-center">
        <nav className="mb-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          <Link
            href="/"
            className="t-eyebrow text-text-dim hover:text-text transition-colors duration-150"
          >
            Home
          </Link>
          <Link
            href="/about"
            className="t-eyebrow text-text transition-colors duration-150"
            aria-current="page"
          >
            About
          </Link>
          <Link
            href="/contact"
            className="t-eyebrow text-text-dim hover:text-text transition-colors duration-150"
          >
            Contact
          </Link>
        </nav>
        <p className="t-eyebrow">
          Inturview · NeetCode 150 · Made for candidates who are serious
        </p>
      </div>
    </footer>
  );
}
