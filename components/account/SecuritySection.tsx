"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Loader2 } from "lucide-react";
import { SectionHeader } from "./ProfileSection";

export function SecuritySection({ email }: { email: string }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const reset = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirm("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirm) {
      setError("New passwords don't match.");
      return;
    }
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("New password must be different from your current one.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/account/change-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Failed (${res.status})`);
      }
      reset();
      setDone(true);
      setTimeout(() => setDone(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't change password");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section>
      <SectionHeader
        eyebrow="Security"
        title="Change password."
        sub="You'll stay signed in here, but any pending reset links get invalidated."
      />

      <div className="panel p-6">
        <form onSubmit={submit} className="space-y-4 max-w-md">
          <label className="block">
            <span className="t-eyebrow">Current password</span>
            <input
              className="input mt-2"
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
            <Link
              href="/forgot-password"
              className="block mt-1 text-xs text-text-muted hover:text-text underline underline-offset-2"
            >
              Forgot it? Use the reset flow instead.
            </Link>
          </label>

          <label className="block">
            <span className="t-eyebrow">New password</span>
            <input
              className="input mt-2"
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min. 8 characters"
              autoComplete="new-password"
            />
          </label>

          <label className="block">
            <span className="t-eyebrow">Confirm new password</span>
            <input
              className="input mt-2"
              type="password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </label>

          {error && (
            <div className="rounded-md border border-hard/40 bg-hard-bg/30 text-hard text-sm px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-1">
            <span className="text-xs text-text-dim">
              Signed in as {email}
            </span>
            <div className="flex items-center gap-3">
              {done && (
                <span
                  className="inline-flex items-center gap-1 text-xs"
                  style={{ color: "rgb(var(--score-hire))" }}
                >
                  <Check className="h-3.5 w-3.5" />
                  Updated
                </span>
              )}
              <button
                type="submit"
                disabled={submitting || !currentPassword || !newPassword || !confirm}
                className="btn btn-primary"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Change password
              </button>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}
