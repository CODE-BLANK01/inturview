"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
        signal: controller.signal,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body.ok !== true) {
        throw new Error(
          body.error || "We could not request a reset link. Please try again.",
        );
      }
      setSent(true);
    } catch (error) {
      setError(
        error instanceof Error && error.name !== "AbortError"
          ? error.message === "Failed to fetch"
            ? "Could not connect. Check your connection and try again."
            : error.message
          : "The request timed out. Please try again.",
      );
    } finally {
      window.clearTimeout(timeout);
      setLoading(false);
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
            <div
              role="status"
              className="rounded-md border border-border bg-bg-inset px-3 py-3 text-sm text-text"
            >
              If <span className="font-medium">{email}</span> matches an
              account, we&apos;ll attempt to send a reset link. Check your inbox
              and spam folder. If it doesn&apos;t arrive, contact{" "}
              <a
                href="mailto:hello@inturview.com"
                className="underline underline-offset-2"
              >
                hello@inturview.com
              </a>
              .
            </div>
            <button
              type="button"
              className="btn w-full"
              onClick={() => setSent(false)}
            >
              Try again or change email
            </button>
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
                disabled={loading}
              />
            </label>

            {error && (
              <p
                role="alert"
                className="rounded-md border border-hard/40 bg-hard-bg/40 text-hard text-sm px-3 py-2"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={loading || !email}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Send reset link
            </button>
          </form>
        )}

        <p className="text-sm text-text-muted mt-5 text-center">
          Remembered it?{" "}
          <Link
            href="/signin"
            className="text-text underline underline-offset-2 hover:text-text-ember"
          >
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
