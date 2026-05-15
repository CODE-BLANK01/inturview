"use client";

import { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  MessageCircle,
  AlertTriangle,
} from "lucide-react";

interface ReadyPromptProps {
  /** True once the interviewer has emitted [READY]. */
  ready: boolean;
  /** Locks the buttons while a stream is in flight. */
  disabled?: boolean;
  /** Number of AI follow-ups so far — used purely for the probing copy. */
  followups: number;
  onStartCoding: () => void;
  /** Called when the user chooses to advance BEFORE the interviewer green-lit them. */
  onSkipAhead: () => void;
  onKeepDiscussing: () => void;
}

export function ReadyPrompt({
  ready,
  disabled,
  followups,
  onStartCoding,
  onSkipAhead,
  onKeepDiscussing,
}: ReadyPromptProps) {
  const [confirmingSkip, setConfirmingSkip] = useState(false);

  if (ready) {
    return (
      <div className="panel border-easy/40 bg-easy/5 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-start gap-3 flex-1">
            <CheckCircle2 className="h-5 w-5 text-easy mt-0.5 shrink-0" />
            <div>
              <h3 className="font-semibold leading-tight">
                The interviewer green-lit your approach.
              </h3>
              <p className="text-sm text-text-muted mt-1">
                Looks like they've heard enough — you can move to the editor whenever
                you're ready, or keep discussing if you want to refine further.
              </p>
            </div>
          </div>
          <div className="flex flex-row gap-2 sm:flex-col lg:flex-row shrink-0">
            <button
              type="button"
              onClick={onKeepDiscussing}
              disabled={disabled}
              className="btn flex-1 sm:flex-none"
            >
              <MessageCircle className="h-4 w-4" />
              Discuss more
            </button>
            <button
              type="button"
              onClick={onStartCoding}
              disabled={disabled}
              className="btn btn-primary flex-1 sm:flex-none"
            >
              Start coding
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Not ready: interviewer is still probing.
  return (
    <div className="panel border-dashed border-border bg-bg-elevated/50 p-4">
      <div className="flex items-start gap-3">
        <MessageCircle className="h-5 w-5 text-text-muted mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-sm text-text">
            {followups === 0
              ? "Waiting for the interviewer to open the conversation…"
              : "The interviewer is still probing — they haven't signaled readiness yet."}
          </p>
          <p className="text-xs text-text-dim mt-1">
            In a real interview, jumping into code before the interviewer is on board hurts
            your communication and collaboration signal. Keep discussing — explain the
            approach, talk through complexity, call out edge cases.
          </p>
        </div>
      </div>

      {!confirmingSkip ? (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => setConfirmingSkip(true)}
            disabled={disabled || followups === 0}
            className="text-xs text-text-dim hover:text-text-muted underline-offset-2 hover:underline disabled:opacity-50"
          >
            Skip ahead anyway
          </button>
        </div>
      ) : (
        <div className="mt-3 rounded-md border border-medium/40 bg-medium/10 p-3 flex flex-col sm:flex-row sm:items-center gap-3">
          <AlertTriangle className="h-4 w-4 text-medium shrink-0" />
          <p className="text-xs text-text flex-1">
            Moving to code without the interviewer's go-ahead will count against your
            <span className="font-medium"> communication</span> and
            <span className="font-medium"> approach quality</span> scores in the debrief.
          </p>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              className="btn"
              onClick={() => setConfirmingSkip(false)}
              disabled={disabled}
            >
              Keep discussing
            </button>
            <button
              type="button"
              className="btn"
              onClick={onSkipAhead}
              disabled={disabled}
            >
              Skip anyway
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
