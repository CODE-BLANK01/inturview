"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, X } from "lucide-react";

interface EndConversationDialogProps {
  sessionId: string;
  onClose: () => void;
}

export function EndConversationDialog({ sessionId, onClose }: EndConversationDialogProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmEnd = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/conversation/abandon", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
        keepalive: true,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Failed (${res.status})`);
      }
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't end session");
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="End session?"
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgb(0 0 0 / 0.55)" }}
      onClick={onClose}
    >
      <div className="panel w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-start gap-2">
            <AlertTriangle
              className="h-4 w-4 mt-0.5"
              style={{ color: "rgb(var(--score-no))" }}
              aria-hidden
            />
            <h3 className="t-section-headline text-lg">End this session?</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-text-muted hover:text-text"
            aria-label="Cancel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="t-body-light text-sm text-text-muted mb-5">
          This session will be marked ended and can&apos;t be resumed. It still counts
          toward your monthly cap. You won&apos;t get a debrief.
        </p>

        {error && (
          <div className="mb-4 rounded-md border border-hard/40 bg-hard-bg/30 text-hard text-sm px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} disabled={submitting} className="btn">
            Keep going
          </button>
          <button
            type="button"
            onClick={confirmEnd}
            disabled={submitting}
            className="btn"
            style={{
              background: "rgb(var(--score-no))",
              color: "rgb(var(--text-inverse))",
              borderColor: "rgb(var(--score-no))",
            }}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            End session
          </button>
        </div>
      </div>
    </div>
  );
}
