import Link from "next/link";
import { ArrowRight, PlayCircle, Plus, Clock, Sparkles } from "lucide-react";
import type { DashboardData } from "@/lib/dashboard";
import { DifficultyBadge, TopicBadge } from "@/components/Badges";
import type { Difficulty } from "@/lib/types";

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

interface ResumeRowProps {
  inProgress: DashboardData["inProgress"];
  lastCompleted: DashboardData["recent"][number] | undefined;
  suggestion: DashboardData["suggestion"];
}

export function ResumeRow({ inProgress, lastCompleted, suggestion }: ResumeRowProps) {
  // 1. Unfinished session — strongest signal, surface first.
  if (inProgress) {
    return (
      <Link
        href={`/interview/${inProgress.problemId}`}
        className="block panel relative overflow-hidden p-5 group hover:border-accent/40 transition-colors"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-accent/10 via-transparent to-transparent pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-accent/15 border border-accent/30 text-accent shrink-0">
            <PlayCircle className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-[0.08em] text-accent">Resume</div>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <span className="text-lg font-semibold truncate">
                {inProgress.problem.title}
              </span>
              <DifficultyBadge value={inProgress.problem.difficulty as Difficulty} />
              <TopicBadge value={inProgress.problem.topic} />
            </div>
            <div className="mt-1 inline-flex items-center gap-1 text-xs text-text-dim">
              <Clock className="h-3.5 w-3.5" />
              Started {timeAgo(inProgress.startedAt)}
            </div>
          </div>
          <span className="btn btn-primary self-start sm:self-auto">
            Continue
            <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      </Link>
    );
  }

  // 2. They've finished at least one — recommend a specific next problem.
  if (suggestion) {
    // Single outer <Link> wraps the whole card. No nested <a> — the
    // "Browse all" affordance lives in the TopNav (Practice tab).
    return (
      <Link
        href={`/interview/${suggestion.problemId}`}
        className="block panel relative overflow-hidden p-5 group hover:border-accent/40 transition-colors"
      >
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-bg-surface border border-border shrink-0">
            <Sparkles className="h-5 w-5 text-text-ember" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-[0.08em] text-text-dim">
              Try this next
            </div>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <span className="text-lg font-semibold truncate">{suggestion.title}</span>
              <DifficultyBadge value={suggestion.difficulty as Difficulty} />
              <TopicBadge value={suggestion.topic} />
            </div>
            <div className="mt-1 text-xs text-text-dim">{suggestion.reason}</div>
          </div>
          <span className="btn btn-primary self-start sm:self-auto">
            Start
            <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      </Link>
    );
  }

  // 3. Truly first-run state — no in-progress, no completions, no suggestion.
  return (
    <Link
      href="/problems"
      className="block panel p-5 group hover:border-accent/40 transition-colors"
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-bg-surface border border-border shrink-0">
          <Plus className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-[0.08em] text-text-dim">Next up</div>
          <div className="mt-1 text-lg font-semibold">
            {lastCompleted ? "Start a new mock interview" : "Run your first mock interview"}
          </div>
          <div className="mt-1 text-xs text-text-dim">
            {lastCompleted
              ? `Last: ${lastCompleted.problem.title} · ${lastCompleted.totalScore ?? "—"}/25`
              : "Browse problems by topic and pick one that stretches you."}
          </div>
        </div>
        <span className="btn self-start sm:self-auto">
          Browse problems
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}
