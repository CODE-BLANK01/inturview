"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function Timer({ startedAt, paused }: { startedAt: number; paused?: boolean }) {
  // Important: do NOT call Date.now() in the useState initializer. SSR would
  // produce one elapsed value, the client another, and React hydration would
  // mismatch on the text. Start at the interview's startedAt (elapsed = 0),
  // then sync to the real wall-clock in useEffect after mount.
  const [now, setNow] = useState<number>(startedAt);

  useEffect(() => {
    // Sync immediately so the timer shows the real elapsed time on mount.
    setNow(Date.now());
    if (paused) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [paused, startedAt]);

  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  return (
    <div
      className="inline-flex items-center gap-1.5 text-sm text-text-muted tabular-nums"
      suppressHydrationWarning
    >
      <Clock className="h-4 w-4" aria-hidden />
      <span suppressHydrationWarning>{fmt(elapsed)}</span>
    </div>
  );
}
