"use client";

import { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

type TimerProps =
  | { startedAt: number; paused?: boolean; sessionId?: never; resumed?: never }
  | { sessionId: string; resumed: boolean; paused?: boolean; startedAt?: never };

export function Timer(props: TimerProps) {
  if ("sessionId" in props) {
    return (
      <ActiveSessionTimer
        sessionId={props.sessionId!}
        resumed={props.resumed!}
        paused={props.paused}
      />
    );
  }
  return <WallClockTimer startedAt={props.startedAt} paused={props.paused} />;
}

function TimerDisplay({ elapsed }: { elapsed: number }) {
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

function WallClockTimer({ startedAt, paused }: { startedAt: number; paused?: boolean }) {
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
  return <TimerDisplay elapsed={elapsed} />;
}

function storageKey(sessionId: string): string {
  return `inturview:active-time:${sessionId}`;
}

function readStoredElapsed(sessionId: string): number {
  try {
    const value = Number(window.localStorage.getItem(storageKey(sessionId)) ?? "0");
    return Number.isFinite(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}

function writeStoredElapsed(sessionId: string, elapsedMs: number): void {
  try {
    window.localStorage.setItem(storageKey(sessionId), String(Math.max(0, elapsedMs)));
  } catch {
    // Storage can be unavailable in private browsing or hardened browsers.
  }
}

/**
 * Practice-session clock. It keeps counting while the interview page remains
 * open, including when another tab is focused, but persists and stops at page
 * close/navigation so time away between visits is excluded. The wall-clock
 * Timer variant remains available for face-to-face sessions that have a real
 * server-side deadline.
 */
function ActiveSessionTimer({
  sessionId,
  resumed,
  paused,
}: {
  sessionId: string;
  resumed: boolean;
  paused?: boolean;
}) {
  const elapsedRef = useRef(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const initial = resumed ? readStoredElapsed(sessionId) : 0;
    if (!resumed) writeStoredElapsed(sessionId, 0);
    elapsedRef.current = initial;
    setElapsedSeconds(Math.floor(initial / 1000));
  }, [resumed, sessionId]);

  useEffect(() => {
    const running = !paused;
    let lastTick = Date.now();

    const advance = () => {
      const now = Date.now();
      if (running) elapsedRef.current += Math.max(0, now - lastTick);
      lastTick = now;
      writeStoredElapsed(sessionId, elapsedRef.current);
      setElapsedSeconds(Math.floor(elapsedRef.current / 1000));
    };

    const id = window.setInterval(advance, 1000);
    window.addEventListener("pagehide", advance);

    return () => {
      advance();
      window.clearInterval(id);
      window.removeEventListener("pagehide", advance);
    };
  }, [paused, sessionId]);

  return <TimerDisplay elapsed={elapsedSeconds} />;
}
