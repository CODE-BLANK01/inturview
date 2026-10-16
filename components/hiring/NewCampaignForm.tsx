"use client";

import { useHiringPaths } from "./HiringPaths";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import type { Recipient } from "@/lib/recipients";
import { RecipientsInput } from "./RecipientsInput";
import { sendAll } from "./SendProgress";

export interface PublishedLoop {
  id: string;
  name: string;
  version: number;
  rounds: number;
  minutes: number;
}

export function NewCampaignForm({ loops, defaultLoopId, roleId }: { loops: PublishedLoop[]; defaultLoopId?: string; roleId?: string }) {
  const paths = useHiringPaths();
  const router = useRouter();
  const [loopId, setLoopId] = useState(defaultLoopId && loops.some((l) => l.id === defaultLoopId) ? defaultLoopId : loops[0]?.id ?? "");
  const [name, setName] = useState("");
  const [deadline, setDeadline] = useState("");
  const [message, setMessage] = useState("");
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [phase, setPhase] = useState<"idle" | "creating" | "sending">("idle");
  const [progress, setProgress] = useState<{ sent: number; failed: number; remaining: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** Bumped after a send from a role page to clear the pasted list. */
  const [formKey, setFormKey] = useState(0);
  const loop = loops.find((l) => l.id === loopId);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setPhase("creating");
    try {
      const res = await fetch(`${paths.api}/campaigns`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ loopTemplateId: loopId, hiringRoleId: roleId ?? null, name, deadline: deadline || null, message: message || null, recipients }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Couldn't create the campaign (${res.status})`);
      setPhase("sending");
      await sendAll(paths.api, body.id, { onProgress: setProgress }).catch((err) => setError(err instanceof Error ? err.message : "Sending stopped"));
      // Inviting from a role: stay on the role, where the new candidates now appear.
      if (roleId) {
        setPhase("idle");
        setRecipients([]);
        setFormKey((k) => k + 1);
        setProgress(null);
        setNotice(`Invited ${body.added}.${body.alreadyInvited ? ` ${body.alreadyInvited} already invited for this role, skipped.` : ""}`);
        router.refresh();
      } else router.push(`${paths.invites}/${body.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setPhase("idle");
    }
  };

  if (loops.length === 0) {
    return <p className="panel p-4 text-sm text-text-muted">Publish a loop first. Invites always send a published version.</p>;
  }
  const busy = phase !== "idle";
  return (
    <form onSubmit={submit} className="space-y-5 max-w-3xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="space-y-1">
          <span className="text-xs uppercase tracking-[0.08em] text-text-dim">Loop</span>
          <select id="c-loop" className="input" value={loopId} onChange={(e) => setLoopId(e.target.value)}>
            {loops.map((l) => <option key={l.id} value={l.id}>{l.name} · v{l.version}</option>)}
          </select>
          {loop && <span className="text-xs text-text-dim">{loop.rounds} round{loop.rounds === 1 ? "" : "s"} · about {loop.minutes} minutes</span>}
        </label>
        {!roleId && (
          <label className="space-y-1">
            <span className="text-xs uppercase tracking-[0.08em] text-text-dim">Campaign name (internal)</span>
            <input id="c-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Payments backend · October" required />
          </label>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-3">
        <label className="space-y-1">
          <span className="text-xs uppercase tracking-[0.08em] text-text-dim">Deadline</span>
          <input id="c-deadline" type="date" className="input" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          <span className="text-xs text-text-dim">Empty: links work for 14 days</span>
        </label>
        <label className="space-y-1">
          <span className="text-xs uppercase tracking-[0.08em] text-text-dim">Note to candidates (optional)</span>
          <textarea id="c-message" className="input min-h-[78px] text-sm" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Thanks for applying! This is the first step; it takes under an hour." />
        </label>
      </div>

      <RecipientsInput key={formKey} onChange={setRecipients} />

      {error && <div className="panel border-hard/40 bg-hard/10 px-3 py-2 text-sm text-hard">{error}</div>}
      {notice && !error && <p className="text-sm text-accent" role="status">{notice}</p>}
      {progress && (
        <p className="text-sm text-text-muted" role="status">
          Sent {progress.sent}{progress.failed ? `, ${progress.failed} failed` : ""}{progress.remaining ? `, ${progress.remaining} to go…` : "."}
        </p>
      )}
      <button type="submit" className="btn btn-primary" disabled={busy || recipients.length === 0 || (!roleId && !name.trim())}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {phase === "creating" ? "Creating…" : phase === "sending" ? "Sending invites…" : `Send ${recipients.length || ""} invite${recipients.length === 1 ? "" : "s"}`}
      </button>
    </form>
  );
}
