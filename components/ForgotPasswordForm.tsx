"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
    } catch {
      /* never surface — the endpoint always returns 200 anyway */
    } finally {
      setLoading(false);
      setSent(true);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="panel p-7">
        <h1 className="t-section-headline text-2xl mb-1">Reset password</h1>
        <p className="t-body-light text-sm text-text-muted mb-6">
          Enter the email you signed up with. If we find an account, we&apos;ll
          send a reset link. It expires in 1 hour.
        </p>

        {sent ? (
          <div className="space-y-4">
            <div className="rounded-md border border-border bg-bg-inset px-3 py-3 text-sm text-text">
              If <span className="font-medium">{email}</span> matches an account,
              the link is on its way. Check your inbox (and spam folder).
            </div>
            <Link href="/signin" className="btn w-full">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <label className="block">
              <span className="t-eyebrow">Email</span>
              <input
                className="input mt-1"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </label>

            <button type="submit" className="btn btn-primary w-full" disabled={loading || !email}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Send reset link
            </button>
          </form>
        )}

        <p className="text-sm text-text-muted mt-5 text-center">
          Remembered it?{" "}
          <Link href="/signin" className="text-text underline underline-offset-2 hover:text-text-ember">
            Sign in
          </Link>
        </p>
      </div>

      <div className="text-center mt-6">
        <Link href="/" className="text-xs text-text-dim hover:text-text-muted">
          ← Back to landing
        </Link>
      </div>
    </div>
  );
}
