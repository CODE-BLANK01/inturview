"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { Check, Copy, KeyRound, Loader2, ShieldCheck, ShieldOff, X } from "lucide-react";
import { SectionHeader } from "./ProfileSection";

interface SetupState {
  setupToken: string;
  qrDataUrl: string;
  otpauthUrl: string;
}

export function TwoFactorSection({ enabled }: { enabled: boolean }) {
  const [isEnabled, setIsEnabled] = useState(enabled);
  const [setup, setSetup] = useState<SetupState | null>(null);
  const [setupCode, setSetupCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [loading, setLoading] = useState<"setup" | "verify" | "disable" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const startSetup = async () => {
    setLoading("setup");
    setError(null);
    setRecoveryCodes(null);
    try {
      const res = await fetch("/api/account/2fa/setup", { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `Failed (${res.status})`);
      setSetup(j as SetupState);
      setSetupCode("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start setup");
    } finally {
      setLoading(null);
    }
  };

  const verifySetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setup) return;
    setLoading("verify");
    setError(null);
    try {
      const res = await fetch("/api/account/2fa/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ setupToken: setup.setupToken, code: setupCode }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `Failed (${res.status})`);
      setIsEnabled(true);
      setSetup(null);
      setRecoveryCodes(j.recoveryCodes || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't verify code");
    } finally {
      setLoading(null);
    }
  };

  const disable = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading("disable");
    setError(null);
    try {
      const res = await fetch("/api/account/2fa/disable", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: disablePassword, code: disableCode }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `Failed (${res.status})`);
      signOut({ callbackUrl: "/signin?reason=revoked" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't disable 2FA");
      setLoading(null);
    }
  };

  const copyRecoveryCodes = async () => {
    if (!recoveryCodes) return;
    await navigator.clipboard.writeText(recoveryCodes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <section>
      <SectionHeader
        eyebrow="Two-factor authentication"
        title="Protect sign-in."
        sub="Use an authenticator app and keep recovery codes somewhere safe."
      />

      <div className="panel p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              {isEnabled ? (
                <ShieldCheck className="h-5 w-5" style={{ color: "rgb(var(--score-hire))" }} />
              ) : (
                <KeyRound className="h-5 w-5 text-text-muted" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-text">
                {isEnabled ? "2FA is enabled" : "2FA is not enabled"}
              </p>
              <p className="text-sm text-text-muted mt-1">
                {isEnabled
                  ? "Your next sign-in will require an authenticator or recovery code."
                  : "Add a second step before anyone can enter your account."}
              </p>
            </div>
          </div>

          {!isEnabled && !setup && !recoveryCodes && (
            <button
              type="button"
              onClick={startSetup}
              disabled={loading === "setup"}
              className="btn btn-primary"
            >
              {loading === "setup" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              Enable 2FA
            </button>
          )}
        </div>

        {error && (
          <div className="rounded-md border border-hard/40 bg-hard-bg/30 text-hard text-sm px-3 py-2">
            {error}
          </div>
        )}

        {setup && (
          <form onSubmit={verifySetup} className="space-y-4 max-w-md">
            <div className="rounded-md border border-border bg-bg-inset/30 p-4">
              <img src={setup.qrDataUrl} alt="Authenticator QR code" className="h-[220px] w-[220px]" />
              <p className="mt-3 break-all text-xs text-text-dim">{setup.otpauthUrl}</p>
            </div>
            <label className="block">
              <span className="t-eyebrow">Authenticator code</span>
              <input
                className="input mt-2"
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                value={setupCode}
                onChange={(e) => setSetupCode(e.target.value)}
                placeholder="123456"
              />
            </label>
            <div className="flex items-center gap-2">
              <button type="submit" disabled={loading === "verify"} className="btn btn-primary">
                {loading === "verify" && <Loader2 className="h-4 w-4 animate-spin" />}
                Verify and enable
              </button>
              <button type="button" onClick={() => setSetup(null)} className="btn">
                <X className="h-4 w-4" />
                Cancel
              </button>
            </div>
          </form>
        )}

        {recoveryCodes && (
          <div className="space-y-3 max-w-md">
            <div className="rounded-md border border-border bg-bg-inset/30 p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-sm">
                {recoveryCodes.map((code) => (
                  <span key={code}>{code}</span>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={copyRecoveryCodes} className="btn">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy codes"}
              </button>
              <button
                type="button"
                onClick={() => setRecoveryCodes(null)}
                className="btn btn-primary"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {isEnabled && !recoveryCodes && (
          <form onSubmit={disable} className="space-y-4 max-w-md">
            <h3 className="t-cta text-sm">Disable 2FA</h3>
            <label className="block">
              <span className="t-eyebrow">Current password</span>
              <input
                className="input mt-2"
                type="password"
                required
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                autoComplete="current-password"
              />
            </label>
            <label className="block">
              <span className="t-eyebrow">Authenticator or recovery code</span>
              <input
                className="input mt-2"
                required
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value)}
                autoComplete="one-time-code"
                placeholder="123456"
              />
            </label>
            <button
              type="submit"
              disabled={loading === "disable" || !disablePassword || !disableCode}
              className="btn"
            >
              {loading === "disable" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldOff className="h-4 w-4" />
              )}
              Disable 2FA
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
