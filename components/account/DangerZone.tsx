"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";

const CONFIRM_PHRASE = "delete my account";

interface DangerZoneProps {
  email: string;
  isAdmin: boolean;
}

export function DangerZone({ email, isAdmin }: DangerZoneProps) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    confirm.trim().toLowerCase() === CONFIRM_PHRASE && password.length > 0 && !submitting;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm, password }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Failed (${res.status})`);
      }
      // Account is gone — drop the JWT and send them to the landing page.
      await signOut({ callbackUrl: "/" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete");
      setSubmitting(false);
    }
  };

  return (
    <section>
      <header className="mb-4">
        <p
          className="t-eyebrow mb-1.5"
          style={{ color: "rgb(var(--score-no))" }}
        >
          Danger zone
        </p>
        <h2 className="t-section-headline text-xl">Delete this account.</h2>
        <p className="t-body-light text-text-muted mt-1 text-sm max-w-xl">
          Wipes the account and every interview, transcript, code submission, and
          debrief tied to it. Cannot be undone.
        </p>
      </header>

      <div
        className="rounded-xl border p-6"
        style={{
          borderColor: "rgb(var(--score-no) / 0.35)",
          background: "rgb(var(--score-no-bg) / 0.25)",
        }}
      >
        {!open ? (
          <div className="flex items-start sm:items-center justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3 max-w-xl">
              <AlertTriangle
                className="h-5 w-5 mt-0.5 shrink-0"
                style={{ color: "rgb(var(--score-no))" }}
                aria-hidden
              />
              <div>
                <p className="text-sm text-text">
                  Permanently delete <span className="font-medium">{email}</span>.
                </p>
                <p className="text-xs text-text-muted mt-1">
                  {isAdmin
                    ? "Heads up: if you're the only admin, the action will be blocked until you promote someone else."
                    : "All your interview history disappears with the account."}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="btn"
              style={{
                background: "rgb(var(--score-no))",
                color: "rgb(var(--text-inverse))",
                borderColor: "rgb(var(--score-no))",
              }}
            >
              <Trash2 className="h-4 w-4" />
              Delete account
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm text-text max-w-md">
                Type{" "}
                <span
                  className="font-mono px-1 py-0.5 rounded"
                  style={{ background: "rgb(var(--bg-inverse))", color: "rgb(var(--text-inverse))" }}
                >
                  {CONFIRM_PHRASE}
                </span>{" "}
                below and re-enter your password to confirm.
              </p>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setConfirm("");
                  setPassword("");
                  setError(null);
                }}
                className="text-text-muted hover:text-text"
                aria-label="Cancel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <label className="block">
              <span className="t-eyebrow">Confirm phrase</span>
              <input
                className="input mt-2 font-mono"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder={CONFIRM_PHRASE}
                autoComplete="off"
              />
            </label>

            <label className="block">
              <span className="t-eyebrow">Your password</span>
              <input
                className="input mt-2"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>

            {error && (
              <div className="rounded-md border border-hard/40 bg-hard-bg/40 text-hard text-sm px-3 py-2">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setConfirm("");
                  setPassword("");
                  setError(null);
                }}
                className="btn"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className="btn"
                style={{
                  background: "rgb(var(--score-no))",
                  color: "rgb(var(--text-inverse))",
                  borderColor: "rgb(var(--score-no))",
                  opacity: canSubmit ? 1 : 0.6,
                }}
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                <Trash2 className="h-4 w-4" />
                Delete forever
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
