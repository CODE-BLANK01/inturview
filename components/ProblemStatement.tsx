"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { DifficultyBadge, TopicBadge } from "./Badges";
import type { Problem } from "@/lib/types";

export function ProblemStatement({
  problem,
  collapsed: forcedCollapsed,
}: {
  problem: Problem;
  collapsed?: boolean;
}) {
  const [open, setOpen] = useState(!forcedCollapsed);
  const showCollapse = forcedCollapsed !== undefined;

  return (
    <article className="panel p-5">
      <header className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <DifficultyBadge value={problem.difficulty} />
            <TopicBadge value={problem.topic} />
          </div>
          <h1 className="text-xl font-semibold">{problem.title}</h1>
        </div>
        <a
          href={problem.leetcode_url}
          target="_blank"
          rel="noreferrer noopener"
          className="text-text-dim hover:text-text inline-flex items-center gap-1 text-sm shrink-0"
        >
          LeetCode <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </header>

      {showCollapse && (
        <button
          className="text-xs text-text-muted hover:text-text mb-2 inline-flex items-center gap-1"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          {open ? "Hide details" : "Show details"}
        </button>
      )}

      {open && (
        <div className="space-y-4 text-sm">
          <p className="text-text whitespace-pre-wrap leading-relaxed">{problem.description}</p>

          <div>
            <h3 className="text-text-muted text-xs uppercase tracking-wide mb-1.5">
              Examples
            </h3>
            <div className="space-y-2">
              {problem.examples.map((ex, i) => (
                <div key={i} className="rounded-md bg-bg-surface border border-border p-3 font-mono text-xs">
                  <div>
                    <span className="text-text-dim">Input:</span> {ex.input}
                  </div>
                  <div>
                    <span className="text-text-dim">Output:</span> {ex.output}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-text-muted text-xs uppercase tracking-wide mb-1.5">
              Constraints
            </h3>
            <ul className="list-disc pl-5 space-y-0.5 text-text-muted">
              {problem.constraints.map((c, i) => (
                <li key={i}>
                  <span className="font-mono text-xs">{c}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </article>
  );
}
