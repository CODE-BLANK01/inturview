import Link from "next/link";
import {
  Code2,
  Network,
  Users,
  ClipboardList,
  Video,
  ArrowRight,
  Lock,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { FACE_TO_FACE_ENABLED } from "@/lib/features";

interface Mode {
  key: string;
  title: string;
  blurb: string;
  icon: LucideIcon;
  href?: string;
  status: "live" | "waitlist" | "soon" | "planned";
}

const MODES: Mode[] = [
  {
    key: "screen",
    title: "Recruiter screen",
    blurb: "Practice your story, motivation, role fit, and compensation in a text-based screen.",
    icon: ClipboardList,
    href: "/recruiter-screen",
    status: "live",
  },
  {
    key: "behavioral",
    title: "Behavioral",
    blurb: "Practice specific STAR stories with follow-up questions and a scorecard.",
    icon: Users,
    href: "/behavioral",
    status: "live",
  },
  {
    key: "coding",
    title: "Coding interview",
    blurb: "Work through approach, code, and debrief with an AI interviewer.",
    icon: Code2,
    href: "/problems",
    status: "live",
  },
  {
    key: "system-design",
    title: "System design",
    blurb: "Clarify scope, sketch on a whiteboard, and get a debrief.",
    icon: Network,
    href: "/design-problems",
    status: "live",
  },
  {
    key: "face-to-face",
    title: "Face-to-face",
    blurb: FACE_TO_FACE_ENABLED
      ? "Live video technical round — answer out loud, scored on depth and delivery."
      : "A live AI interviewer with voice, video, and delivery feedback is on the way.",
    icon: Video,
    href: FACE_TO_FACE_ENABLED
      ? "/face-to-face"
      : "mailto:hello@inturview.com?subject=Face-to-face%20early%20access",
    status: FACE_TO_FACE_ENABLED ? "live" : "waitlist",
  },
];

export function PracticeModes() {
  return (
    <section>
      <div className="mb-3 flex items-end justify-between">
        <h2 className="text-sm uppercase tracking-[0.08em] text-text-dim">
          Practice modes
        </h2>
        <span className="text-xs text-text-dim">Choose the round you want to practice</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
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
  const isWaitlist = mode.status === "waitlist";
  const isInteractive = (isLive || isWaitlist) && Boolean(mode.href);

  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    isInteractive && mode.href ? (
      isWaitlist ? (
        <a
          href={mode.href}
          className="group relative panel p-5 flex flex-col hover:border-accent/40 transition-colors overflow-hidden"
        >
          {children}
        </a>
      ) : (
        <Link
          href={mode.href}
          className="group relative panel p-5 flex flex-col hover:border-accent/40 transition-colors overflow-hidden"
        >
          {children}
        </Link>
      )
    ) : (
      <div className="relative panel p-5 flex flex-col opacity-80 cursor-not-allowed select-none">
        {children}
      </div>
    );

  return (
    <Wrapper>
      {isInteractive && (
        <div className="absolute inset-0 bg-gradient-to-br from-accent/8 via-transparent to-transparent pointer-events-none" />
      )}
      <div className="relative flex items-start justify-between">
        <div
          className={`inline-flex h-9 w-9 items-center justify-center rounded-md border ${
            isInteractive
              ? "bg-accent/15 border-accent/30 text-accent"
              : "bg-bg-surface border-border text-text-muted"
          }`}
        >
          {isInteractive ? <Icon className="h-5 w-5" /> : <Lock className="h-4 w-4" />}
        </div>
        <StatusPill status={mode.status} />
      </div>
      <h3 className="relative mt-4 font-semibold leading-tight">{mode.title}</h3>
      <p className="relative mt-1 text-sm text-text-muted leading-relaxed">{mode.blurb}</p>
      {isInteractive && (
        <div className="relative mt-4 inline-flex items-center gap-1 text-sm text-accent">
          {isWaitlist ? "Join waitlist" : "Start"}{" "}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </div>
      )}
    </Wrapper>
  );
}

function StatusPill({ status }: { status: Mode["status"] }) {
  const map: Record<Mode["status"], { label: string; cls: string }> = {
    live: { label: "Live", cls: "border-easy/40 bg-easy/10 text-easy" },
    waitlist: { label: "Incoming", cls: "border-medium/40 bg-medium/10 text-medium" },
    soon: { label: "This quarter", cls: "border-medium/40 bg-medium/10 text-medium" },
    planned: { label: "Planned", cls: "border-border bg-bg-surface text-text-dim" },
  };
  const s = map[status];
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
}
