"use client";

import { useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { Check, Loader2, LogOut } from "lucide-react";
import { SectionHeader } from "./ProfileSection";
import { TwoFactorSection } from "./TwoFactorSection";

export function SecuritySection({
  email,
  twoFactorEnabled,
}: {
  email: string;
  twoFactorEnabled: boolean;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [postSave, setPostSave] = useState<null | "signing-out">(null);

  const [revoking, setRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirm) {
      setError("New passwords don't match.");
      return;
    }
    if (newPassword.length < 10) {
      setError("New password must be at least 10 characters.");
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
      // Password change bumps tokenVersion server-side, so the current JWT
      // is now revoked. Show a brief confirmation, then sign out → /signin.
      setPostSave("signing-out");
      setTimeout(() => {
        signOut({ callbackUrl: "/signin?reason=password-changed" });
      }, 1400);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't change password");
      setSubmitting(false);
    }
  };

  const revokeAll = async () => {
    if (
      !window.confirm(
        "Sign out of every device, including this one? You'll need to sign in again."
      )
    ) {
      return;
    }
    setRevoking(true);
    setRevokeError(null);
    try {
      const res = await fetch("/api/account/revoke-sessions", { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Failed (${res.status})`);
      }
      signOut({ callbackUrl: "/signin?reason=revoked" });
    } catch (e) {
      setRevokeError(e instanceof Error ? e.message : "Couldn't revoke");
      setRevoking(false);
    }
  };

  return (
    <section>
      <SectionHeader
        eyebrow="Security"
        title="Password & sessions."
        sub="Change your password or kick every other device off your account."
      />

      <div className="panel p-6 space-y-7">
        {/* Change password */}
        <form onSubmit={submit} className="space-y-4 max-w-md">
          <h3 className="t-cta text-sm">Change password</h3>

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
              minLength={10}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min. 10 characters"
              autoComplete="new-password"
            />
          </label>

          <label className="block">
            <span className="t-eyebrow">Confirm new password</span>
            <input
              className="input mt-2"
              type="password"
              required
              minLength={10}
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

          {postSave === "signing-out" && (
            <div
              className="rounded-md border px-3 py-2 text-sm flex items-center gap-2"
              style={{
                borderColor: "rgb(var(--score-hire) / 0.4)",
                background: "rgb(var(--score-hire-bg) / 0.4)",
                color: "rgb(var(--score-hire))",
              }}
            >
              <Check className="h-4 w-4 shrink-0" />
              <span>
                Password updated — signing you out to refresh your session.
              </span>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-1">
            <span className="text-xs text-text-dim">Signed in as {email}</span>
            <button
              type="submit"
              disabled={
                submitting ||
                !!postSave ||
                !currentPassword ||
                !newPassword ||
                !confirm
              }
              className="btn btn-primary"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Change password
            </button>
          </div>
        </form>

        <div
          className="h-px w-full"
          style={{ background: "rgb(var(--border-base))" }}
          aria-hidden
        />

        {/* Sign out everywhere */}
        <div className="space-y-3 max-w-2xl">
          <h3 className="t-cta text-sm">Active sessions</h3>
          <p className="text-sm text-text-muted leading-relaxed">
            Suspect someone has access to your account? &ldquo;Sign out everywhere&rdquo;
            kicks every device — including this one — and forces a fresh sign-in
            with your password.
          </p>
          {revokeError && (
            <div className="rounded-md border border-hard/40 bg-hard-bg/30 text-hard text-sm px-3 py-2">
              {revokeError}
            </div>
          )}
          <div>
            <button
              type="button"
              onClick={revokeAll}
              disabled={revoking}
              className="btn"
            >
              {revoking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
              Sign out everywhere
            </button>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <TwoFactorSection enabled={twoFactorEnabled} />
      </div>
    </section>
  );
}
