import type { DesignPhase } from "@/lib/stream";

const PHASES: { id: DesignPhase; label: string }[] = [
  { id: "scope", label: "Scope" },
  { id: "design", label: "Design" },
  { id: "debrief", label: "Debrief" },
];

export function DesignPhaseIndicator({ current }: { current: DesignPhase }) {
  const idx = PHASES.findIndex((p) => p.id === current);
  return (
    <div className="flex items-center gap-2 text-sm">
      {PHASES.map((p, i) => {
        const state = i < idx ? "done" : i === idx ? "active" : "pending";
        const dot =
          state === "done"
            ? "bg-accent border-accent"
            : state === "active"
            ? "bg-accent/30 border-accent"
            : "bg-bg-surface border-border";
        const text =
          state === "active"
            ? "text-text font-medium"
            : state === "done"
            ? "text-text-muted"
            : "text-text-dim";
        return (
          <div key={p.id} className="flex items-center gap-2">
            <span className={`inline-block h-2.5 w-2.5 rounded-full border ${dot}`} />
            <span className={text}>{p.label}</span>
            {i < PHASES.length - 1 && (
              <span className="mx-1 h-px w-6 bg-border" aria-hidden />
            )}
          </div>
        );
      })}
    </div>
  );
}
