"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Trash2 } from "lucide-react";
import { useHiringPaths } from "./HiringPaths";

const day = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

/** Retention status, and export/delete for a data request (owners and workspace admins). */
export function ApplicantDataControls({ inviteId, dueAt, redactedAt, canManage }: { inviteId: string; dueAt: string; redactedAt: string | null; canManage: boolean }) {
  const paths = useHiringPaths();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const base = `${paths.api}/candidates/${inviteId}/data`;

  if (redactedAt) return <p className="text-xs text-text-dim">This applicant&apos;s data was deleted on {day(redactedAt)}.</p>;
  return (
    <div className="text-xs text-text-dim space-y-2">
      <p>Their answers, scores and your notes are deleted on {day(dueAt)}, as they were told.</p>
      {canManage && (
        <div className="flex flex-wrap items-center gap-2">
          <a className="btn text-xs" href={base} download>
            <Download className="h-3.5 w-3.5" /> Export their data
          </a>
          {confirming ? (
            <span className="inline-flex items-center gap-2">
              <input className="input text-xs py-1 w-28" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Type DELETE" aria-label="Type DELETE to confirm" />
              <button
                type="button"
                className="btn text-xs text-hard"
                disabled={typed !== "DELETE" || busy}
                onClick={async () => {
                  setBusy(true);
                  setError(null);
                  const res = await fetch(base, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm: typed }) }).catch(() => null);
                  setBusy(false);
                  if (!res?.ok) return setError((await res?.json().catch(() => ({})))?.error ?? "Couldn't delete. Try again.");
                  router.refresh();
                }}
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Delete now
              </button>
              <button type="button" className="text-text-muted" onClick={() => setConfirming(false)}>Cancel</button>
            </span>
          ) : (
            <button type="button" className="btn text-xs" onClick={() => setConfirming(true)}>
              <Trash2 className="h-3.5 w-3.5" /> Delete their data now
            </button>
          )}
          {error && <span role="alert" className="text-hard">{error}</span>}
        </div>
      )}
    </div>
  );
}
