"use client";

import { CheckCircle2, AlertCircle } from "lucide-react";
import { RecommendationBadge } from "../Badges";
import type { DesignDebrief } from "@/lib/designTypes";

const DIMENSION_LABELS: Record<keyof DesignDebrief["scores"], string> = {
  requirements_clarity: "Requirements Clarity",
  architecture_design: "Architecture Design",
  scalability: "Scalability",
  tradeoff_reasoning: "Trade-off Reasoning",
  communication: "Communication",
};

export function DesignDebriefView({ debrief }: { debrief: DesignDebrief }) {
  const dims = Object.entries(debrief.scores) as [
    keyof DesignDebrief["scores"],
    DesignDebrief["scores"][keyof DesignDebrief["scores"]],
  ][];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <section className="panel p-5 lg:col-span-3">
        <h2 className="text-lg font-semibold mb-3">Interviewer feedback</h2>
        <p className="text-text-muted whitespace-pre-wrap mb-5">
          {debrief.interviewer_summary}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
          <div>
            <h3 className="text-sm font-medium text-text-muted mb-2">Strengths</h3>
            <ul className="space-y-1.5">
              {debrief.strengths.map((s, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-easy shrink-0" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-medium text-text-muted mb-2">Improvements</h3>
            <ul className="space-y-1.5">
              {debrief.improvements.map((s, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <AlertCircle className="h-4 w-4 mt-0.5 text-medium shrink-0" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-text-muted mb-2">
            Reference architecture
          </h3>
          <p className="text-sm text-text whitespace-pre-wrap">
            {debrief.optimal_solution_notes}
          </p>
        </div>
      </section>

      <section className="panel p-5 lg:col-span-2 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Scorecard</h2>
          <RecommendationBadge value={debrief.overall_recommendation} />
        </div>
        <div className="flex items-baseline gap-2 mb-5">
          <span className="text-4xl font-semibold tabular-nums">
            {debrief.total_score}
          </span>
          <span className="text-text-muted">/ {debrief.max_score}</span>
        </div>

        <div className="space-y-4">
          {dims.map(([key, dim]) => (
            <ScoreBar
              key={key}
              label={DIMENSION_LABELS[key]}
              score={dim.score}
              max={dim.max}
              evidence={dim.evidence}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function ScoreBar({
  label,
  score,
  max,
  evidence,
}: {
  label: string;
  score: number;
  max: number;
  evidence: string;
}) {
  const pct = Math.max(0, Math.min(100, (score / max) * 100));
  const color = score >= 4 ? "bg-easy" : score === 3 ? "bg-accent" : "bg-medium";
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span>{label}</span>
        <span className="tabular-nums text-text-muted">
          {score}/{max}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-bg-surface">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      {evidence && <p className="mt-1 text-xs text-text-dim">{evidence}</p>}
    </div>
  );
}
