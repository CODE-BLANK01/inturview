"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, MessageSquare, Star, UserPlus, X } from "lucide-react";
import type { ReviewPanelData } from "@/lib/hiring/reviews";
import { useHiringPaths } from "./HiringPaths";

const when = (d: Date | string) => new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function ReviewPanel({
  inviteId,
  data,
  canReview,
  canDecide,
  canAssign,
}: {
  inviteId: string;
  data: ReviewPanelData;
  canReview: boolean;
  canDecide: boolean;
  canAssign: boolean;
}) {
  const paths = useHiringPaths();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [pendingDecision, setPendingDecision] = useState<"ADVANCE" | "DECLINE" | null>(null);
  const [decisionNote, setDecisionNote] = useState("");
  const [assignee, setAssignee] = useState("");
  const base = `${paths.api}/candidates/${inviteId}`;

  const call = async (key: string, url: string, init: RequestInit) => {
    setBusy(key);
    setError(null);
    const res = await fetch(url, { ...init, headers: { "content-type": "application/json" } }).catch(() => null);
    const body = await res?.json().catch(() => ({}));
    setBusy(null);
    if (!res?.ok) {
      setError(body?.error ?? "That didn't save. Try again.");
      return false;
    }
    router.refresh();
    return true;
  };

  const unassigned = data.members.filter((m) => !data.assigned.some((a) => a.userId === m.userId));

  return (
    <section className="panel p-5 space-y-5" aria-labelledby="review-heading">
      <h2 id="review-heading" className="font-semibold">Review</h2>

      {/* Decision */}
      <div className="space-y-2">
        {data.decision ? (
          <p className={`text-sm font-medium ${data.decision.value === "ADVANCE" ? "text-accent" : "text-text-muted"}`}>
            {data.decision.value === "ADVANCE" ? "Advanced" : "Declined"}
            <span className="font-normal text-text-dim"> · {data.decision.by ?? "a teammate"}, {when(data.decision.at)}</span>
          </p>
        ) : (
          <p className="text-sm text-text-muted">No decision yet.</p>
        )}
        {canDecide &&
          (pendingDecision ? (
            <div className="space-y-2">
              <textarea
                className="input w-full min-h-[60px] text-sm"
                maxLength={2000}
                value={decisionNote}
                onChange={(e) => setDecisionNote(e.target.value)}
                placeholder={pendingDecision === "ADVANCE" ? "Why advance? (optional)" : "Why decline? (optional, for your team)"}
                aria-label="Decision note"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-primary text-sm"
                  disabled={!!busy}
                  onClick={async () => {
                    if (await call("decide", `${base}/decision`, { method: "POST", body: JSON.stringify({ decision: pendingDecision, body: decisionNote }) })) {
                      setPendingDecision(null);
                      setDecisionNote("");
                    }
                  }}
                >
                  {busy === "decide" && <Loader2 className="h-4 w-4 animate-spin" />}
                  {pendingDecision === "ADVANCE" ? "Confirm advance" : "Confirm decline"}
                </button>
                <button type="button" className="btn text-sm" onClick={() => setPendingDecision(null)}>Cancel</button>
              </div>
              <p className="text-xs text-text-dim">The candidate isn&apos;t emailed. Contact them yourselves.</p>
            </div>
          ) : (
            <div className="flex gap-2">
              {data.decision?.value !== "ADVANCE" && (
                <button type="button" className="btn text-sm" onClick={() => setPendingDecision("ADVANCE")}>
                  <Check className="h-4 w-4" /> {data.decision ? "Change to advance" : "Advance"}
                </button>
              )}
              {data.decision?.value !== "DECLINE" && (
                <button type="button" className="btn text-sm" onClick={() => setPendingDecision("DECLINE")}>
                  <X className="h-4 w-4" /> {data.decision ? "Change to decline" : "Decline"}
                </button>
              )}
            </div>
          ))}
      </div>

      {/* Ratings */}
      <div className="space-y-2 border-t border-border pt-4">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-medium">Ratings</h3>
          <span className="text-xs text-text-dim">
            {data.ratings.average !== null ? `${data.ratings.average} average from ${data.ratings.count}` : `${data.ratings.count} teammate${data.ratings.count === 1 ? "" : "s"} rated`}
          </span>
        </div>
        {canReview && (
          <div className="flex items-center gap-1" role="group" aria-label="Your rating">
            <span className="text-xs text-text-muted mr-2">Yours:</span>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={data.ratings.mine === n}
                aria-label={`${n} of 5`}
                disabled={!!busy}
                className={`h-8 w-8 rounded-md border text-sm tabular-nums ${data.ratings.mine === n ? "border-accent bg-accent/10 text-accent font-semibold" : "border-border hover:bg-bg-inset"}`}
                onClick={() => call(`rate-${n}`, `${base}/ratings`, { method: "POST", body: JSON.stringify({ rating: n }) })}
              >
                {busy === `rate-${n}` ? <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto" /> : n}
              </button>
            ))}
          </div>
        )}
        {data.ratings.others === null && data.ratings.count > 0 && (
          <p className="text-xs text-text-dim">Rate first to see your teammates&apos; ratings, so theirs don&apos;t sway yours.</p>
        )}
        {data.ratings.others && data.ratings.others.length > 0 && (
          <ul className="text-sm text-text-muted space-y-0.5">
            {data.ratings.others.map((o) => (
              <li key={o.author} className="flex items-center gap-1.5"><Star className="h-3.5 w-3.5" /> {o.author}: {o.rating}/5</li>
            ))}
          </ul>
        )}
      </div>

      {/* Assignment */}
      <div className="space-y-2 border-t border-border pt-4">
        <h3 className="text-sm font-medium">Reviewers</h3>
        {data.assigned.length === 0 ? (
          <p className="text-sm text-text-dim">Nobody assigned.</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {data.assigned.map((a) => (
              <li key={a.userId} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-sm">
                {a.name}
                {canAssign && (
                  <button type="button" aria-label={`Unassign ${a.name}`} className="text-text-dim hover:text-text" disabled={!!busy} onClick={() => call("unassign", `${base}/assignments?userId=${encodeURIComponent(a.userId)}`, { method: "DELETE" })}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {canAssign && unassigned.length > 0 && (
          <div className="flex gap-2">
            <select className="input text-sm flex-1" value={assignee} onChange={(e) => setAssignee(e.target.value)} aria-label="Teammate to assign">
              <option value="">Assign a teammate…</option>
              {unassigned.map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}
            </select>
            <button
              type="button"
              className="btn text-sm"
              disabled={!assignee || !!busy}
              onClick={async () => {
                if (await call("assign", `${base}/assignments`, { method: "POST", body: JSON.stringify({ userId: assignee }) })) setAssignee("");
              }}
            >
              <UserPlus className="h-4 w-4" /> Assign
            </button>
          </div>
        )}
      </div>

      {/* Notes and history */}
      <div className="space-y-3 border-t border-border pt-4">
        <h3 className="text-sm font-medium">Notes</h3>
        {canReview && (
          <form
            className="space-y-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await call("note", `${base}/notes`, { method: "POST", body: JSON.stringify({ body: note }) })) setNote("");
            }}
          >
            <textarea className="input w-full min-h-[70px] text-sm" maxLength={4000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What stood out? Visible to your team, never to the candidate." aria-label="Note" />
            <button className="btn text-sm" disabled={!note.trim() || !!busy}>
              {busy === "note" ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />} Add note
            </button>
          </form>
        )}
        {data.feed.length === 0 ? (
          <p className="text-sm text-text-dim">Nothing yet.</p>
        ) : (
          <ol className="space-y-3">
            {[...data.feed].reverse().map((f) => (
              <li key={f.id} className="text-sm">
                <p className="text-xs text-text-dim">
                  {f.author} · {when(f.at)}
                  {f.kind === "RATING" && ` · rated ${f.rating}/5`}
                  {f.kind === "DECISION" && ` · ${f.decision === "ADVANCE" ? "advanced" : "declined"}`}
                </p>
                {f.body && <p className="whitespace-pre-wrap">{f.body}</p>}
              </li>
            ))}
          </ol>
        )}
      </div>

      {error && <p role="alert" className="text-sm text-hard">{error}</p>}
    </section>
  );
}
