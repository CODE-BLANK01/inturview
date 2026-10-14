"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

/** What the candidate agrees to before any round starts. Written to be read, not skipped. */
export function InviteConsent({ token, consented }: { token: string; consented: boolean }) {
  const [agreed, setAgreed] = useState(false);
  const [done, setDone] = useState(consented);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/invites/consent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    }).catch(() => null);
    if (res?.ok) setDone(true);
    else setError((await res?.json().catch(() => ({})))?.error ?? "Something went wrong. Try again.");
    setBusy(false);
  };

  if (done) {
    return (
      <div className="panel p-7 space-y-2" role="status">
        <h2 className="text-lg font-semibold">You&apos;re all set</h2>
        <p className="text-sm text-text-muted">
          Thanks. Your first round opens here. Keep this link: you can come back to it any time before it expires.
        </p>
      </div>
    );
  }
  return (
    <div className="panel p-7 space-y-4">
      <h2 className="text-lg font-semibold">Before you start</h2>
      <ul className="text-sm text-text-muted space-y-2 list-disc pl-5">
        <li>An AI interviewer asks the questions and follow-ups. Your answers are recorded and scored against what the role needs.</li>
        <li>People on the hiring team review the results and make every decision. The AI doesn&apos;t decide.</li>
        <li>Your answers are used only for this application. You can ask for them to be deleted by replying to the invitation email.</li>
        <li>Need more time, captions, a text-only format or another adjustment? Reply to the invitation email before you start and we&apos;ll arrange it.</li>
      </ul>
      <label className="flex items-start gap-3 text-sm">
        <input id="invite-consent" type="checkbox" className="mt-1" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        <span>I understand how this interview works and agree to take part.</span>
      </label>
      {error && <p className="text-sm text-hard">{error}</p>}
      <button type="button" className="btn btn-primary w-full" disabled={!agreed || busy} onClick={submit}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" />} Agree and continue
      </button>
    </div>
  );
}
