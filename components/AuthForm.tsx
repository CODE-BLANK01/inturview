"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";

type Mode = "signin" | "signup";

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  // New users always land in /verify-email first. Returning users either
  // honor an explicit callbackUrl (e.g. from a deep link) or get sent to
  // /dashboard — server-side gates re-route them to /verify-email or
  // /onboarding as needed.
  const callbackUrl =
    params.get("callbackUrl") ||
    (mode === "signup" ? "/verify-email" : "/dashboard");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [needsSecondFactor, setNeedsSecondFactor] = useState(false);
  const [secondFactorReady, setSecondFactorReady] = useState(false);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (mode === "signup") {
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            email: email.trim(),
            password,
            name: name.trim() || undefined,
          }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || `Signup failed (${res.status})`);
        }
      }
      const credentials: Record<string, string | boolean> = {
        email: email.trim(),
        password,
        redirect: false,
        callbackUrl,
      };
      if (needsSecondFactor) credentials.totpCode = totpCode.trim();

      const result = await signIn("credentials", credentials);
      if (result?.error) {
        // NextAuth surfaces the message thrown from authorize() as
        // result.error. We use a sentinel prefix to distinguish rate-limit
        // errors (which deserve a specific user-facing message) from every
        // other failure (which intentionally collapses to the generic
        // "invalid credentials" line to avoid enumeration).
        const RATE_LIMIT_PREFIX = "RATE_LIMITED:";
        if (result.error.startsWith(RATE_LIMIT_PREFIX)) {
          throw new Error(result.error.slice(RATE_LIMIT_PREFIX.length).trim());
        }
        const TOTP_REQUIRED_PREFIX = "TOTP_REQUIRED:";
        if (result.error.startsWith(TOTP_REQUIRED_PREFIX)) {
          setNeedsSecondFactor(true);
          setSecondFactorReady(true);
          setTotpCode("");
          return;
        }
        const TOTP_INVALID_PREFIX = "TOTP_INVALID:";
        if (result.error.startsWith(TOTP_INVALID_PREFIX)) {
          setNeedsSecondFactor(true);
          setSecondFactorReady(false);
          throw new Error(result.error.slice(TOTP_INVALID_PREFIX.length).trim());
        }
        throw new Error("Invalid email or password.");
      }
      router.push(callbackUrl);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const reason = params.get("reason");
  const reasonBanner =
    mode === "signin" && reason
      ? reason === "password-changed"
        ? "Password updated. Sign in again with your new password."
        : reason === "revoked"
        ? "Signed out of every device. Sign in to start a fresh session."
        : null
      : null;

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="panel p-7">
        <h1 className="text-2xl font-semibold mb-1">
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="text-sm text-text-muted mb-6">
          {mode === "signin"
            ? "Sign in to continue practicing."
            : "Start running mock interviews in under a minute."}
        </p>

        {reasonBanner && (
          <div className="rounded-md border border-border bg-bg-inset/40 px-3 py-2 text-sm text-text mb-4">
            {reasonBanner}
          </div>
        )}

        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" && (
            <label className="block">
              <span className="text-xs text-text-muted">Name (optional)</span>
              <input
                className="input mt-1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ada Lovelace"
                autoComplete="name"
                maxLength={80}
              />
            </label>
          )}
          <label className="block">
            <span className="text-xs text-text-muted">Email</span>
            <input
              className="input mt-1"
              type="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setNeedsSecondFactor(false);
                setSecondFactorReady(false);
              }}
              placeholder="you@example.com"
              autoComplete="email"
              disabled={needsSecondFactor}
            />
          </label>
          <label className="block">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted">Password</span>
              {mode === "signin" && (
                <Link
                  href="/forgot-password"
                  className="text-xs text-text-muted hover:text-text underline underline-offset-2"
                >
                  Forgot Password?
                </Link>
              )}
            </div>
            <input
              className="input mt-1"
              type="password"
              required
              minLength={mode === "signin" ? undefined : 10}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setNeedsSecondFactor(false);
                setSecondFactorReady(false);
              }}
              placeholder={mode === "signin" ? "Your password" : "Min. 10 characters"}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              disabled={needsSecondFactor}
            />
          </label>

          {needsSecondFactor && (
            <label className="block">
              <span className="text-xs text-text-muted">
                Authenticator or recovery code
              </span>
              <input
                className="input mt-1"
                type="text"
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                placeholder="123456"
                autoFocus
              />
            </label>
          )}

          {secondFactorReady && !error && (
            <div className="rounded-md border border-border bg-bg-inset/40 text-text-muted text-sm px-3 py-2">
              Password verified. Enter your authenticator or recovery code.
            </div>
          )}

          {error && (
            <div className="rounded-md border border-hard/40 bg-hard/10 text-hard text-sm px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={loading}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {needsSecondFactor
              ? "Verify code"
              : mode === "signin"
              ? "Sign in"
              : "Create account"}
          </button>
        </form>

        <p className="text-sm text-text-muted mt-5 text-center">
          {mode === "signin" ? (
            <>
              No account yet?{" "}
              <Link href="/signup" className="text-accent hover:underline">
                Sign up
              </Link>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <Link href="/signin" className="text-accent hover:underline">
                Sign in
              </Link>
            </>
          )}
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
