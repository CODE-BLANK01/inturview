"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, CheckCircle2 } from "lucide-react";

export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 10) {
      setError("Password must be at least 10 characters.");
      return;
    }
    if (!token) {
      setError("Missing reset token. Open the link from your email again.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Failed (${res.status})`);
      }
      setDone(true);
      // We don't know the email here — the next page sends them to signin.
      setTimeout(() => router.push("/signin"), 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  // Surface "missing token" up front so the user doesn't fill out a doomed form.
  if (!token) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="panel p-7">
          <h1 className="t-section-headline text-2xl mb-1">Reset link missing</h1>
          <p className="t-body-light text-sm text-text-muted mb-4">
            This page needs a reset token from your email. Either the link is
            incomplete or it&apos;s already been used.
          </p>
          <Link href="/forgot-password" className="btn w-full">
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="panel p-7 text-center">
          <CheckCircle2 className="h-8 w-8 mx-auto text-easy mb-3" />
          <h1 className="t-section-headline text-2xl mb-1">Password reset</h1>
          <p className="t-body-light text-sm text-text-muted">
            Redirecting you to sign in…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="panel p-7">
        <h1 className="t-section-headline text-2xl mb-1">Set a new password</h1>
        <p className="t-body-light text-sm text-text-muted mb-6">
          Choose something you don&apos;t use elsewhere. At least 10 characters.
        </p>

        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="t-eyebrow">New password</span>
            <input
              className="input mt-1"
              type="password"
              required
              minLength={10}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="Min. 10 characters"
            />
          </label>
          <label className="block">
            <span className="t-eyebrow">Confirm new password</span>
            <input
              className="input mt-1"
              type="password"
              required
              minLength={10}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </label>

          {error && (
            <div className="rounded-md border border-hard/40 bg-hard-bg/40 text-hard text-sm px-3 py-2">
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Set new password
          </button>
        </form>

        <p className="text-sm text-text-muted mt-5 text-center">
          Suddenly remembered it?{" "}
          <Link href="/signin" className="text-text underline underline-offset-2 hover:text-text-ember">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
