"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function Timer({ startedAt, paused }: { startedAt: number; paused?: boolean }) {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [paused]);
  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  return (
    <div className="inline-flex items-center gap-1.5 text-sm text-text-muted tabular-nums">
      <Clock className="h-4 w-4" aria-hidden />
      <span>{fmt(elapsed)}</span>
    </div>
  );
}
