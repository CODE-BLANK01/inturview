"use client";

import { useHiringPaths } from "./HiringPaths";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, Send, UserPlus } from "lucide-react";
import type { Recipient } from "@/lib/recipients";
import { RecipientsInput } from "./RecipientsInput";
import { sendAll } from "./SendProgress";

export function CampaignSendButtons({ campaignId, pending, failed }: { campaignId: string; pending: number; failed: number }) {
  const paths = useHiringPaths();
  const router = useRouter();
  const [busy, setBusy] = useState<"send" | "retry" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const run = async (retryFailed: boolean) => {
    setBusy(retryFailed ? "retry" : "send");
    setNote(null);
    try {
      const r = await sendAll(paths.api, campaignId, { retryFailed });
      setNote(`Sent ${r.sent}${r.failed ? `, ${r.failed} failed` : ""}.`);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Sending failed");
    } finally {
      setBusy(null);
      router.refresh();
    }
  };
  if (!pending && !failed && !note) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {pending > 0 && (
        <button type="button" className="btn btn-primary text-sm" disabled={!!busy} onClick={() => run(false)}>
          {busy === "send" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send {pending} queued
        </button>
      )}
      {failed > 0 && (
        <button type="button" className="btn text-sm" disabled={!!busy} onClick={() => run(true)}>
          {busy === "retry" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Retry {failed} failed
        </button>
      )}
      {note && <span className="text-sm text-text-muted" role="status">{note}</span>}
    </div>
  );
}

export function AddCandidates({ campaignId }: { campaignId: string }) {
  const paths = useHiringPaths();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch(`${paths.api}/campaigns/${campaignId}/recipients`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ recipients }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Couldn't add candidates");
      const r = await sendAll(paths.api, campaignId);
      setNote(`Added ${body.added}${body.skipped ? ` (${body.skipped} already invited)` : ""}; sent ${r.sent}${r.failed ? `, ${r.failed} failed` : ""}.`);
      setOpen(false);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Couldn't add candidates");
    } finally {
      setBusy(false);
      router.refresh();
    }
  };
  if (!open) {
    return (
      <div className="flex items-center gap-3">
        <button type="button" className="btn text-sm" onClick={() => setOpen(true)}><UserPlus className="h-4 w-4" /> Add candidates</button>
        {note && <span className="text-sm text-text-muted" role="status">{note}</span>}
      </div>
    );
  }
  return (
    <div className="panel p-4 space-y-3">
      <RecipientsInput id="add-recipients" onChange={setRecipients} />
      <div className="flex gap-2">
        <button type="button" className="btn btn-primary text-sm" disabled={busy || recipients.length === 0} onClick={submit}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Add and send {recipients.length || ""}
        </button>
        <button type="button" className="btn text-sm" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
      </div>
      {note && <p className="text-sm text-hard">{note}</p>}
    </div>
  );
}

export function InviteRowActions({ inviteId, status }: { inviteId: string; status: string }) {
  const paths = useHiringPaths();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const act = async (action: "resend" | "revoke") => {
    setBusy(action);
    setError(null);
    const res = await fetch(`${paths.api}/invites/${inviteId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    }).catch(() => null);
    const body = await res?.json().catch(() => ({}));
    if (!res?.ok) setError(body?.error || "Failed");
    setBusy(null);
    setConfirmRevoke(false);
    router.refresh();
  };
  if (status === "COMPLETED" || status === "REVOKED") return null;
  return (
    <div className="flex items-center justify-end gap-2 whitespace-nowrap">
      {error && <span className="text-xs text-hard">{error}</span>}
      {status !== "PENDING" && (
        <button type="button" className="text-xs underline underline-offset-2 text-text-muted hover:text-text" disabled={!!busy} onClick={() => act("resend")}>
          {busy === "resend" ? "Sending…" : "Resend"}
        </button>
      )}
      {confirmRevoke ? (
        <>
          <button type="button" className="text-xs underline underline-offset-2 text-hard" disabled={!!busy} onClick={() => act("revoke")}>Confirm cancel</button>
          <button type="button" className="text-xs text-text-dim" onClick={() => setConfirmRevoke(false)}>Keep</button>
        </>
      ) : (
        <button type="button" className="text-xs underline underline-offset-2 text-text-muted hover:text-hard" disabled={!!busy} onClick={() => setConfirmRevoke(true)}>Cancel invite</button>
      )}
    </div>
  );
}
