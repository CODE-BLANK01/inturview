import Link from "next/link";
import {
  Code2,
  Network,
  Users,
  ClipboardList,
  ArrowRight,
  Lock,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Mode {
  key: string;
  title: string;
  blurb: string;
  icon: LucideIcon;
  href?: string;
  status: "live" | "soon" | "planned";
}

const MODES: Mode[] = [
  {
    key: "coding",
    title: "Coding interview",
    blurb: "Three-phase mock: approach, code, debrief. NeetCode 150.",
    icon: Code2,
    href: "/problems",
    status: "live",
  },
  {
    key: "system-design",
    title: "System design",
    blurb: "Free-draw whiteboard, three phases, scorecard at the end.",
    icon: Network,
    href: "/design-problems",
    status: "live",
  },
  {
    key: "behavioral",
    title: "Behavioral",
    blurb: "STAR-method drills against the questions interviewers actually ask.",
    icon: Users,
    href: "/behavioral",
    status: "live",
  },
  {
    key: "screen",
    title: "Recruiter screen",
    blurb: "25-min phone screen — story, motivation, comp expectations.",
    icon: ClipboardList,
    href: "/recruiter-screen",
    status: "live",
  },
];

export function PracticeModes() {
  return (
    <section>
      <div className="mb-3 flex items-end justify-between">
        <h2 className="text-sm uppercase tracking-[0.08em] text-text-dim">
          Practice modes
        </h2>
        <span className="text-xs text-text-dim">More arriving — see roadmap</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {MODES.map((m) => (
          <ModeCard key={m.key} mode={m} />
        ))}
      </div>
    </section>
  );
}

function ModeCard({ mode }: { mode: Mode }) {
  const Icon = mode.icon;
  const isLive = mode.status === "live";

  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    isLive && mode.href ? (
      <Link
        href={mode.href}
        className="group relative panel p-5 flex flex-col hover:border-accent/40 transition-colors overflow-hidden"
      >
        {children}
      </Link>
    ) : (
      <div className="relative panel p-5 flex flex-col opacity-80 cursor-not-allowed select-none">
        {children}
      </div>
    );

  return (
    <Wrapper>
      {isLive && (
        <div className="absolute inset-0 bg-gradient-to-br from-accent/8 via-transparent to-transparent pointer-events-none" />
      )}
      <div className="relative flex items-start justify-between">
        <div
          className={`inline-flex h-9 w-9 items-center justify-center rounded-md border ${
            isLive
              ? "bg-accent/15 border-accent/30 text-accent"
              : "bg-bg-surface border-border text-text-muted"
          }`}
        >
          {isLive ? <Icon className="h-5 w-5" /> : <Lock className="h-4 w-4" />}
        </div>
        <StatusPill status={mode.status} />
      </div>
      <h3 className="relative mt-4 font-semibold leading-tight">{mode.title}</h3>
      <p className="relative mt-1 text-sm text-text-muted leading-relaxed">{mode.blurb}</p>
      {isLive && (
        <div className="relative mt-4 inline-flex items-center gap-1 text-sm text-accent">
          Start <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </div>
      )}
    </Wrapper>
  );
}

function StatusPill({ status }: { status: Mode["status"] }) {
  const map: Record<Mode["status"], { label: string; cls: string }> = {
    live: { label: "Live", cls: "border-easy/40 bg-easy/10 text-easy" },
    soon: { label: "This quarter", cls: "border-medium/40 bg-medium/10 text-medium" },
    planned: { label: "Planned", cls: "border-border bg-bg-surface text-text-dim" },
  };
  const s = map[status];
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
}
