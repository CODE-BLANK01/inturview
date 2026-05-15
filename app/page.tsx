import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
  GitBranch,
  FileText,
  Globe,
  BarChart3,
  Network,
  Users,
  Sparkles,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { TopNav } from "@/components/TopNav";
import { PROBLEMS } from "@/lib/problems";

export default async function LandingPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <>
      <TopNav />
      <main>
        <Hero />
        <PositioningSection />
        <HowItWorks />
        <BehaviorSection />
        <RoadmapSection />
        <FinalCTA />
        <Footer />
      </main>
    </>
  );
}

/* ---------- Hero ---------- */

function Hero() {
  return (
    <section className="relative">
      <BackgroundGrid />
      <div className="relative mx-auto max-w-6xl px-4 pt-20 pb-16 sm:pt-28 sm:pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-16 items-center">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-text-dim font-medium">
              intervue · mock interviews, scored properly
            </p>
            <h1 className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-semibold leading-[1.02] tracking-tight">
              Practice for the room,
              <br />
              <span className="text-text-muted">not the worksheet.</span>
            </h1>
            <p className="mt-6 text-lg text-text-muted max-w-xl leading-relaxed">
              A mock-interview surface that grades how you reach the answer, not
              just whether you do. Same three-phase loop top engineering teams
              run — approach, code, debrief — with an interviewer that pushes
              back when your reasoning is thin.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/signup"
                className="btn btn-primary px-4 py-2.5 text-base"
              >
                Start practicing free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#how" className="btn px-4 py-2.5 text-base">
                See how it scores
              </a>
            </div>
            <div className="mt-8 flex items-center gap-5 text-xs text-text-dim">
              <SoftFact label="Problems seeded" value={PROBLEMS.length.toString()} />
              <SoftFact label="Phases per interview" value="3" />
              <SoftFact label="Scoring dimensions" value="5" />
            </div>
          </div>

          <HeroPreview />
        </div>
      </div>
    </section>
  );
}

function SoftFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="font-mono text-sm text-text tabular-nums">{value}</span>
      <span>{label}</span>
    </div>
  );
}

function HeroPreview() {
  return (
    <div className="relative">
      <div className="absolute -inset-8 bg-gradient-to-br from-accent/15 via-transparent to-transparent blur-3xl pointer-events-none" />
      <div className="relative panel p-3 shadow-2xl">
        {/* Window chrome */}
        <div className="flex items-center justify-between px-2 pt-1 pb-2.5">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-bg-surface border border-border" />
            <span className="h-2.5 w-2.5 rounded-full bg-bg-surface border border-border" />
            <span className="h-2.5 w-2.5 rounded-full bg-bg-surface border border-border" />
          </div>
          <span className="font-mono text-[10px] text-text-dim tracking-wide">
            intervue · Two Sum · Approach phase
          </span>
          <span className="text-[10px] text-text-dim">02:14</span>
        </div>

        <div className="rounded-md border border-border bg-bg overflow-hidden">
          {/* Chat preview */}
          <div className="p-4 space-y-2.5 text-sm">
            <Bubble role="assistant">
              Walk me through your approach before any code. What&apos;s your
              first instinct?
            </Bubble>
            <Bubble role="user">
              Hash map: scan once, store value→index, check if (target − x) is
              present.
            </Bubble>
            <Bubble role="assistant">
              Sound. What&apos;s the time and space, and which edge case worries
              you most?
            </Bubble>
            <Bubble role="user">
              O(n) time, O(n) space. The duplicate-value case — same number used
              twice — needs care.
            </Bubble>
            <Bubble role="assistant" tone="ready">
              Sounds good — that approach is solid. Let&apos;s see the
              implementation.
            </Bubble>
          </div>

          {/* Ready strip */}
          <div className="border-t border-border bg-easy/5 px-4 py-2.5 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs text-easy">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Interviewer green-lit your approach
            </span>
            <span className="btn btn-primary text-xs py-1 px-2.5">
              Start coding →
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Bubble({
  role,
  tone,
  children,
}: {
  role: "user" | "assistant";
  tone?: "ready";
  children: React.ReactNode;
}) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 leading-relaxed ${
          isUser
            ? "bg-accent text-white"
            : tone === "ready"
            ? "bg-easy/10 border border-easy/30 text-text"
            : "bg-bg-surface border border-border text-text"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function BackgroundGrid() {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgb(212 201 168 / 1) 1px, transparent 1px), linear-gradient(to bottom, rgb(212 201 168 / 1) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage:
            "radial-gradient(ellipse 80% 60% at 50% 0%, black 30%, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 60% at 50% 0%, black 30%, transparent 80%)",
        }}
      />
    </div>
  );
}

/* ---------- Positioning ---------- */

function PositioningSection() {
  return (
    <Section index="01" eyebrow="Why this exists">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-12 lg:gap-16 items-start">
        <h2 className="text-3xl sm:text-4xl font-semibold leading-tight tracking-tight">
          Most prep optimizes for the answer. Real interviews score the path.
        </h2>
        <div className="space-y-5 text-text-muted leading-relaxed">
          <p>
            Grinding LeetCode trains pattern recognition. It does not train you
            to talk through ambiguity, ask the question that unlocks a
            constraint, or stop yourself from coding before the interviewer is
            on board.
          </p>
          <p>
            Those are the things that actually decide outcomes in the room — and
            they&apos;re the things every standard prep tool ignores, because
            grading a conversation is harder than grading a function.
          </p>
          <p className="text-text">
            intervue scores the conversation. Five dimensions, one
            recommendation, an interviewer who behaves like one.
          </p>
        </div>
      </div>
    </Section>
  );
}

/* ---------- How it works ---------- */

function HowItWorks() {
  const phases = [
    {
      num: "01",
      title: "Approach",
      blurb:
        "Explain your plan before you type. The interviewer probes complexity, edge cases, alternatives — and won't green-light you until your reasoning holds.",
      sample: "Sounds good — that approach is solid. Let's see the implementation.",
      tone: "ready" as const,
    },
    {
      num: "02",
      title: "Code",
      blurb:
        "Write in Monaco — Python, JS, Java, or C++. Ask short clarifying questions on the side. The interviewer sees your editor live and won't solve the problem for you.",
      sample: "What does the inner loop's condition give you when the array is sorted?",
      tone: "probe" as const,
    },
    {
      num: "03",
      title: "Debrief",
      blurb:
        "A rubric across five dimensions (understanding, approach, correctness, complexity, communication), a hiring-committee-shape summary, and a recommendation: Strong Hire / Hire / No Hire.",
      sample: "Strong Hire · 22/25",
      tone: "score" as const,
    },
  ];

  return (
    <Section id="how" index="02" eyebrow="How it runs" wash>
      <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-12 max-w-2xl">
        Three phases, gated by the interviewer&apos;s judgment.
      </h2>
      <ol className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border rounded-lg overflow-hidden">
        {phases.map((p) => (
          <li key={p.num} className="bg-bg-elevated p-6 flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <span className="font-mono text-xs text-text-dim tracking-wider">
                {p.num}
              </span>
              <h3 className="font-semibold text-lg">{p.title}</h3>
            </div>
            <p className="text-sm text-text-muted leading-relaxed flex-1">
              {p.blurb}
            </p>
            <PhaseSample tone={p.tone} text={p.sample} />
          </li>
        ))}
      </ol>
    </Section>
  );
}

function PhaseSample({
  tone,
  text,
}: {
  tone: "ready" | "probe" | "score";
  text: string;
}) {
  const styles = {
    ready: "border-easy/40 bg-easy/5 text-easy",
    probe: "border-accent/30 bg-accent/5 text-accent",
    score: "border-easy/40 bg-easy/10 text-easy font-mono tabular-nums",
  } as const;
  return (
    <div
      className={`mt-5 rounded-md border px-3 py-2 text-xs leading-snug ${styles[tone]}`}
    >
      {text}
    </div>
  );
}

/* ---------- Behavior ---------- */

function BehaviorSection() {
  return (
    <Section index="03" eyebrow="The thing nobody else does">
      <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-12 items-start">
        <div>
          <h2 className="text-3xl sm:text-4xl font-semibold leading-tight tracking-tight">
            Skip ahead anyway?
            <br />
            <span className="text-text-muted">It costs you.</span>
          </h2>
          <p className="mt-5 text-text-muted leading-relaxed">
            Every approach-phase response carries a hidden signal: <span className="font-mono text-text">[CONTINUE]</span>{" "}
            or <span className="font-mono text-text">[READY]</span>. We strip
            the tag, but the UI lights up green only when the interviewer is
            actually on board.
          </p>
          <p className="mt-3 text-text-muted leading-relaxed">
            You can still skip — real candidates do. But the debrief caps your
            communication and approach-quality scores when you jump past the
            interviewer&apos;s buy-in. Just like a real loop.
          </p>
        </div>

        <div className="grid gap-3">
          <SignalRow
            tone="probe"
            icon={
              <span className="font-mono text-xs tracking-wider">[CONTINUE]</span>
            }
            text="What's the time complexity of that, and which edge case worries you most?"
          />
          <SignalRow
            tone="ready"
            icon={<CheckCircle2 className="h-4 w-4" />}
            text="Sounds good — that approach is solid. Let's see the implementation."
          />
          <div className="panel border-medium/30 bg-medium/5 p-4 flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-medium mt-0.5 shrink-0" />
            <p className="text-xs text-text leading-relaxed">
              Moving to code without the interviewer&apos;s go-ahead will count
              against your <span className="font-medium">communication</span>{" "}
              and <span className="font-medium">approach quality</span> scores
              in the debrief.
            </p>
          </div>
        </div>
      </div>
    </Section>
  );
}

function SignalRow({
  tone,
  icon,
  text,
}: {
  tone: "ready" | "probe";
  icon: React.ReactNode;
  text: string;
}) {
  const styles =
    tone === "ready"
      ? "border-easy/40 bg-easy/5 text-easy"
      : "border-accent/30 bg-accent/5 text-accent";
  return (
    <div className={`panel border ${styles} p-4`}>
      <div className="flex items-center gap-2 mb-1">{icon}</div>
      <p className="text-sm text-text">{text}</p>
    </div>
  );
}

/* ---------- Roadmap ---------- */

function RoadmapSection() {
  const items = [
    {
      icon: Network,
      title: "System design simulator",
      when: "This quarter",
      blurb:
        "Whiteboard-style sessions. Capacity math, single-points-of-failure probing, and trade-off scoring.",
    },
    {
      icon: Users,
      title: "Behavioral drills",
      when: "This quarter",
      blurb:
        "STAR-method drills, ambiguity scenarios, calibrated push-back on weak stories.",
    },
    {
      icon: FileText,
      title: "Resume bullet generator",
      when: "This quarter",
      blurb:
        "Turn each project you ship into 2–3 quantified resume bullets in your voice.",
    },
    {
      icon: Globe,
      title: "Public portfolio",
      when: "Soon",
      blurb:
        "intervue.dev/you — your best debriefs, projects, and progress, shareable as a link.",
    },
    {
      icon: GitBranch,
      title: "GitHub project sync",
      when: "Soon",
      blurb:
        "Import repos, auto-detect stack, surface what you actually ship in vs what you grind.",
    },
    {
      icon: BarChart3,
      title: "LeetCode progress import",
      when: "Later",
      blurb:
        "Pull your solved set. We skip what you already know and target your real gaps.",
    },
  ];

  return (
    <Section index="04" eyebrow="What's coming" wash>
      <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight max-w-2xl">
          Coding interviews today. The whole loop, eventually.
        </h2>
        <p className="text-sm text-text-muted max-w-sm">
          A real interview process is more than one whiteboard round. We&apos;re
          building toward all of it.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border rounded-lg overflow-hidden">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <div key={it.title} className="bg-bg-elevated p-5">
              <div className="flex items-start justify-between mb-4">
                <Icon className="h-5 w-5 text-text-muted" />
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-dim">
                  {it.when}
                </span>
              </div>
              <h3 className="font-semibold">{it.title}</h3>
              <p className="mt-1 text-sm text-text-muted leading-relaxed">
                {it.blurb}
              </p>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

/* ---------- Final CTA ---------- */

function FinalCTA() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="panel p-10 sm:p-14 relative overflow-hidden">
          <div className="absolute -top-24 -right-24 h-72 w-72 bg-accent/15 blur-3xl rounded-full pointer-events-none" />
          <div className="relative grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-8 items-center">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-text-dim font-medium">
                Ready when you are
              </p>
              <h2 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight leading-tight">
                Run your first mock interview in under a minute.
              </h2>
              <p className="mt-4 text-text-muted max-w-md">
                Free during beta. No card, no install. Pick a problem, talk
                through your approach, write the code, get the scorecard.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <Link href="/signup" className="btn btn-primary px-4 py-2.5 text-base">
                Create your account
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/signin" className="btn px-4 py-2.5 text-base">
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Footer ---------- */

function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <span className="font-semibold tracking-tight">
                intervue<span className="text-accent">.</span>
              </span>
            </div>
            <p className="text-xs text-text-dim leading-relaxed max-w-xs">
              Mock interviews that grade the conversation, not just the
              function. Built for engineers who&apos;ve outgrown LeetCode
              grinding.
            </p>
          </div>
          <FooterCol title="Product">
            <FooterLink href="/signup">Get started</FooterLink>
            <FooterLink href="/signin">Sign in</FooterLink>
            <FooterLink href="#how">How it works</FooterLink>
          </FooterCol>
          <FooterCol title="Resources">
            <FooterLink href="#" disabled>
              Docs
            </FooterLink>
            <FooterLink href="#" disabled>
              Changelog
            </FooterLink>
            <FooterLink href="mailto:hello@intervue.dev" external>
              Contact
            </FooterLink>
          </FooterCol>
          <FooterCol title="Company">
            <FooterLink href="#" disabled>
              About
            </FooterLink>
            <FooterLink href="#" disabled>
              Privacy
            </FooterLink>
            <FooterLink href="#" disabled>
              Terms
            </FooterLink>
          </FooterCol>
        </div>
        <div className="mt-10 pt-6 border-t border-border flex items-center justify-between text-xs text-text-dim">
          <span>© {new Date().getFullYear()} intervue. All rights reserved.</span>
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" />
            Powered by Anthropic Claude
          </span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="text-xs uppercase tracking-[0.12em] text-text-dim mb-3">
        {title}
      </h4>
      <ul className="space-y-2">{children}</ul>
    </div>
  );
}

function FooterLink({
  href,
  children,
  external,
  disabled,
}: {
  href: string;
  children: React.ReactNode;
  external?: boolean;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <li>
        <span className="text-text-dim/60 cursor-not-allowed inline-flex items-center gap-1">
          {children}
          <span className="text-[10px] text-text-dim/60">soon</span>
        </span>
      </li>
    );
  }
  return (
    <li>
      <Link
        href={href}
        className="text-text-muted hover:text-text inline-flex items-center gap-1"
        {...(external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
      >
        {children}
        {external && <ArrowUpRight className="h-3 w-3" />}
      </Link>
    </li>
  );
}

/* ---------- Section wrapper ---------- */

function Section({
  index,
  eyebrow,
  children,
  id,
  wash,
}: {
  index: string;
  eyebrow: string;
  children: React.ReactNode;
  id?: string;
  wash?: boolean;
}) {
  return (
    <section
      id={id}
      className={`relative ${wash ? "bg-bg-elevated/40 border-y border-border" : ""}`}
    >
      <div className="mx-auto max-w-6xl px-4 py-20 sm:py-24">
        <div className="flex items-center gap-3 mb-10">
          <span className="font-mono text-xs text-text-dim tracking-wider">
            {index}
          </span>
          <span className="h-px w-8 bg-border" />
          <span className="text-xs uppercase tracking-[0.14em] text-text-dim">
            {eyebrow}
          </span>
        </div>
        {children}
      </div>
    </section>
  );
}
