"use client";

import { useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { Mail, Loader2, Check, AlertTriangle } from "lucide-react";

interface VerifyEmailStandbyProps {
  email: string;
  /** Optional banner shown above the form — explains why the user landed here
   *  (expired link, used link, etc.). */
  topMessage?: { tone: "error" | "info"; text: string };
}

export function VerifyEmailStandby({ email, topMessage }: VerifyEmailStandbyProps) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resend = async () => {
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/resend-verification", { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Failed (${res.status})`);
      }
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="panel p-7">
        <div
          className="inline-flex h-10 w-10 items-center justify-center rounded-md mb-4"
          style={{
            background: "rgb(var(--bg-inverse))",
            color: "rgb(var(--text-inverse))",
          }}
        >
          <Mail className="h-5 w-5" />
        </div>

        <h1 className="t-section-headline text-2xl mb-1">Verify your email.</h1>
        <p className="t-body-light text-sm text-text-muted mb-6">
          We sent a link to <span className="text-text font-medium">{email}</span>.
          Click it to finish setting up your account. The link expires in 24 hours.
        </p>

        {topMessage && (
          <div
            className={`mb-4 rounded-md border px-3 py-2 text-sm flex items-start gap-2 ${
              topMessage.tone === "error"
                ? "border-hard/40 text-hard"
                : "border-border text-text-muted bg-bg-inset/40"
            }`}
            style={
              topMessage.tone === "error"
                ? { background: "rgb(var(--score-no-bg) / 0.4)" }
                : undefined
            }
          >
            {topMessage.tone === "error" ? (
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            ) : null}
            <span>{topMessage.text}</span>
          </div>
        )}

        {sent ? (
          <div
            className="rounded-md border px-3 py-2.5 text-sm flex items-start gap-2"
            style={{
              borderColor: "rgb(var(--score-hire) / 0.4)",
              background: "rgb(var(--score-hire-bg) / 0.4)",
              color: "rgb(var(--score-hire))",
            }}
          >
            <Check className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              Fresh link sent. Check your inbox (and spam folder).
            </span>
          </div>
        ) : (
          <button
            onClick={resend}
            disabled={sending}
            type="button"
            className="btn w-full"
          >
            {sending && <Loader2 className="h-4 w-4 animate-spin" />}
            Resend verification email
          </button>
        )}

        {error && (
          <p className="mt-3 text-xs text-hard">{error}</p>
        )}

        <p className="text-xs text-text-dim mt-6 text-center leading-relaxed">
          Wrong address? Sign out and start over.
          <br />
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/signup" })}
            className="underline underline-offset-2 hover:text-text-muted mt-1"
          >
            Sign out
          </button>
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
