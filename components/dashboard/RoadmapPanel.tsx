import { GitBranch, FileText, Globe, BarChart3, Sparkles, Lock } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface RoadmapItem {
  title: string;
  blurb: string;
  icon: LucideIcon;
  when: "soon" | "later";
}

const ITEMS: RoadmapItem[] = [
  {
    title: "Resume bullet generator",
    blurb: "Turn each project into 2–3 quantified resume bullets in your voice.",
    icon: FileText,
    when: "soon",
  },
  {
    title: "Public portfolio",
    blurb: "An intervue.dev/you page with your debriefs and best interviews.",
    icon: Globe,
    when: "soon",
  },
  {
    title: "GitHub sync",
    blurb: "Import projects + tag languages you actually ship in.",
    icon: GitBranch,
    when: "soon",
  },
  {
    title: "LeetCode progress import",
    blurb: "Pull your existing solved set; we skip what you already know.",
    icon: BarChart3,
    when: "later",
  },
  {
    title: "AI mentor digest",
    blurb: "Weekly summary of what to drill next based on your gaps.",
    icon: Sparkles,
    when: "later",
  },
];

export function RoadmapPanel() {
  return (
    <aside className="panel p-5 lg:sticky lg:top-20 self-start">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">Coming up</h2>
        <span className="badge border-border bg-bg-surface text-text-dim">Roadmap</span>
      </div>

      <ul className="space-y-3">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <li
              key={item.title}
              className="group flex items-start gap-3 rounded-md p-2 -m-2 hover:bg-bg-surface transition-colors"
            >
              <div className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-bg-surface border border-border text-text-muted shrink-0">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-medium">{item.title}</span>
                  <Lock className="h-3 w-3 text-text-dim" />
                </div>
                <p className="text-xs text-text-dim mt-0.5 leading-relaxed">{item.blurb}</p>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-5 pt-4 border-t border-border">
        <p className="text-xs text-text-dim leading-relaxed">
          Have a request? Hit{" "}
          <a href="mailto:hello@intervue.dev" className="text-text-muted hover:text-text underline-offset-2 hover:underline">
            hello@intervue.dev
          </a>{" "}
          and we&apos;ll add it to the queue.
        </p>
      </div>
    </aside>
  );
}
