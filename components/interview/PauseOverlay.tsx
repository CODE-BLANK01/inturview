"use client";

import { PlayCircle } from "lucide-react";

interface PauseOverlayProps {
  onResume: () => void;
  onEnd: () => void;
}

/**
 * Full-page overlay shown when the candidate pauses an in-progress interview.
 * Deliberately judgmental copy — pausing is allowed but the product opinion
 * is that it dilutes the practice. The overlay blocks every interaction with
 * the underlying chat/editor until they resume.
 */
export function PauseOverlay({ onResume, onEnd }: PauseOverlayProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Interview paused"
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{
        background: "rgb(var(--bg-page) / 0.86)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
    >
      <div className="panel w-full max-w-lg p-8 sm:p-10 text-center">
        <p className="t-eyebrow mb-4">Paused</p>
        <h2 className="t-section-headline text-3xl sm:text-[34px] leading-tight">
          The clock&apos;s stopped.
          <br />
          <span className="t-italic">So is the practice.</span>
        </h2>
        <p className="t-body text-text-muted mt-5 max-w-md mx-auto">
          Better to practice right in the moment. Pausing and taking time to
          think will hinder your learning — real interviews don&apos;t pause,
          and the discomfort is the whole point.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={onResume}
            className="btn btn-primary text-[15px] px-5 py-2.5"
            autoFocus
          >
            <PlayCircle className="h-4 w-4" />
            Resume
          </button>
          <button
            type="button"
            onClick={onEnd}
            className="text-xs text-text-muted hover:text-text underline underline-offset-2"
          >
            …or end the session instead
          </button>
        </div>
      </div>
    </div>
  );
}
