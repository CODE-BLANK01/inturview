"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, RotateCw, Send } from "lucide-react";

type Msg = { id: string; role: "interviewer" | "candidate"; content: string; clientTurnId?: string | null };
type Timing = { startedAt: string; plannedMinutes: number; deadlineAt: string | null; serverNow: string };
/** An answer that's stored (or being sent) but has no reply yet. Retrying reuses its id. */
type Unreplied = { clientTurnId: string; content: string; reason: string };

/** One id per answer. getRandomValues covers browsers without randomUUID (older Safari). */
const newTurnId = () =>
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID().replace(/-/g, "")
    : Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
const MINUTE = 60_000;

/** One interview round as a conversation. The candidate never sees scores. */
export function LoopRoundChat({
  token, roundIndex, roundCount, title, minutes, isCoding,
}: { token: string; roundIndex: number; roundCount: number; title: string; minutes: number; isCoding: boolean }) {
  const [roundRunId, setRoundRunId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [phase, setPhase] = useState<"loading" | "chat" | "replying" | "finishing" | "done">("loading");
  const [error, setError] = useState<string | null>(null);
  const [unreplied, setUnreplied] = useState<Unreplied | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [timing, setTiming] = useState<(Timing & { skew: number }) | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [draftState, setDraftState] = useState<"idle" | "saving" | "saved">("idle");
  const bottom = useRef<HTMLDivElement>(null);
  const loadedDraft = useRef<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    // Block body on purpose: newer browsers return a Promise from scrollIntoView,
    // and an effect must return nothing or a cleanup function.
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const finish = useCallback(async (id: string) => {
    setPhase("finishing");
    setError(null);
    const res = await fetch("/api/i/finish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, roundRunId: id }),
    }).catch(() => null);
    if (res?.ok) setPhase("done");
    else {
      setError("Couldn't save the end of this round. Try again.");
      setPhase("chat");
    }
  }, [token]);

  useEffect(() => {
    let stale = false; // ignore the duplicate run React does in development
    (async () => {
      let res: Response | null = null;
      let body: {
        roundRunId?: string; status?: string; messages?: Msg[]; pending?: boolean; error?: string;
        unanswered?: string | null; draft?: string; timing?: Timing;
      } = {};
      // If another request is still writing the opening line, wait for it.
      for (let attempt = 0; attempt < 8; attempt++) {
        res = await fetch("/api/i/round", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token, roundIndex }),
        }).catch(() => null);
        body = (await res?.json().catch(() => ({}))) ?? {};
        if (stale || !res?.ok || !body.pending) break;
        await new Promise((r) => setTimeout(r, 1500));
      }
      if (stale) return;
      if (!res?.ok) {
        setError(body?.error ?? "Couldn't open this round.");
        return;
      }
      const msgs = body.messages ?? [];
      setRoundRunId(body.roundRunId ?? null);
      setMessages(msgs);
      if (body.timing) setTiming({ ...body.timing, skew: new Date(body.timing.serverNow).getTime() - Date.now() });
      loadedDraft.current = body.draft ?? "";
      setDraft(body.draft ?? "");
      // Refreshed while the interviewer was replying: offer to get that reply.
      const waiting = body.unanswered && msgs.find((m) => m.clientTurnId === body.unanswered);
      if (waiting) setUnreplied({ clientTurnId: waiting.clientTurnId!, content: waiting.content, reason: "The interviewer's reply didn't arrive." });
      setPhase(body.status === "IN_PROGRESS" ? "chat" : "done");
    })();
    return () => {
      stale = true;
    };
  }, [token, roundIndex]);

  // Save the unsent answer as the candidate types, so a refresh doesn't lose it.
  useEffect(() => {
    if (!roundRunId || phase === "loading" || phase === "done" || draft === loadedDraft.current) return;
    setDraftState("saving");
    const t = setTimeout(async () => {
      const res = await fetch("/api/i/draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, roundRunId, draft }),
      }).catch(() => null);
      if (res?.ok) loadedDraft.current = draft;
      setDraftState(res?.ok ? "saved" : "idle");
    }, 800);
    return () => clearTimeout(t);
  }, [draft, roundRunId, phase, token]);

  const deliver = async (turn: { clientTurnId: string; content: string }) => {
    if (!roundRunId) return;
    setError(null);
    setUnreplied(null);
    setPhase("replying");
    const replyId = `i-${turn.clientTurnId}`;
    setMessages((m) => [
      ...(m.some((x) => x.clientTurnId === turn.clientTurnId) ? m : [...m, { id: `c-${turn.clientTurnId}`, role: "candidate" as const, content: turn.content, clientTurnId: turn.clientTurnId }]),
      { id: replyId, role: "interviewer" as const, content: "" },
    ]);
    let complete = false;
    try {
      const res = await fetch("/api/i/message", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, roundRunId, ...turn }),
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        if (body.ended) {
          setMessages((m) => m.filter((x) => x.id !== replyId));
          setError(body.error ?? "This round has ended.");
          setPhase("done");
          return;
        }
        throw new Error(body.error ?? "Your answer didn't send.");
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (!line) continue;
          const ev = JSON.parse(line) as { t?: string; done?: boolean; complete?: boolean; error?: string };
          if (ev.t) setMessages((m) => m.map((x) => (x.id === replyId ? { ...x, content: x.content + ev.t } : x)));
          if (ev.error) throw new Error(ev.error);
          if (ev.done) complete = !!ev.complete;
        }
      }
      setPhase("chat");
      if (complete) await finish(roundRunId);
    } catch (e) {
      // Keep the answer on screen; retrying sends the same id, so it's stored once.
      setMessages((m) => m.filter((x) => x.id !== replyId));
      setUnreplied({ ...turn, reason: e instanceof Error ? e.message : "Your answer didn't send." });
      setPhase("chat");
    }
  };

  const send = () => {
    const content = draft.trim();
    if (!content || !roundRunId || phase !== "chat" || unreplied) return;
    setDraft("");
    loadedDraft.current = "";
    void deliver({ clientTurnId: newTurnId(), content });
  };

  // Server time, corrected for this device's clock.
  const serverNow = now + (timing?.skew ?? 0);
  const elapsed = timing ? Math.max(0, Math.floor((serverNow - new Date(timing.startedAt).getTime()) / MINUTE)) : 0;
  const planned = timing?.plannedMinutes ?? minutes;
  const closesIn = timing?.deadlineAt ? Math.ceil((new Date(timing.deadlineAt).getTime() - serverNow) / MINUTE) : null;
  const last = roundIndex === roundCount - 1;
  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-4">
      <header className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="t-eyebrow">Round {roundIndex + 1} of {roundCount}</p>
          <h1 className="t-section-headline text-2xl truncate">{title}</h1>
        </div>
        <span className={`text-sm tabular-nums whitespace-nowrap ${elapsed >= planned ? "text-medium" : "text-text-dim"}`} aria-label="Time in this round">
          {elapsed} / {planned} min
        </span>
      </header>
      {phase !== "done" && timing && elapsed >= planned && (
        <p className="text-sm text-medium" role="status">
          The planned time is up. Finish your current answer; the interviewer will wrap up.
          {closesIn !== null && closesIn > 0 && closesIn <= 10 && ` The round closes in ${closesIn} minute${closesIn === 1 ? "" : "s"}.`}
        </p>
      )}

      <div className="panel p-4 sm:p-5 min-h-[50vh] flex flex-col gap-3" aria-live="polite">
        {phase === "loading" && !error && (
          <p className="text-sm text-text-muted inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Your interviewer is getting ready…</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={m.role === "candidate" ? "self-end max-w-[85%]" : "self-start max-w-[90%]"}>
            <p className="text-xs text-text-dim mb-1">{m.role === "candidate" ? "You" : "Interviewer"}</p>
            <div className={`rounded-lg px-3.5 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap ${m.role === "candidate" ? "bg-bg-inset" : "border border-border"}`}>
              {m.content || <span className="text-text-dim">…</span>}
            </div>
          </div>
        ))}
        {unreplied && phase === "chat" && (
          <div className="self-end text-sm flex items-center gap-2" role="alert">
            <span className="text-hard">{unreplied.reason}</span>
            <button type="button" className="btn text-sm" onClick={() => void deliver(unreplied)}>
              <RotateCw className="h-4 w-4" /> Get the reply
            </button>
          </div>
        )}
        <div ref={bottom} />
      </div>

      {error && <p className="text-sm text-hard" role="alert">{error}</p>}

      {phase === "done" ? (
        <div className="panel p-5 space-y-3" role="status">
          <p className="font-medium">Round {roundIndex + 1} complete.</p>
          <p className="text-sm text-text-muted">{last ? "That was the last round. Thank you!" : "Take a break if you like. The next round is ready whenever you are; its clock starts when you open it."}</p>
          {/* A full page load, not client navigation: the round list must show fresh progress, not a cached copy. */}
          <a href={last ? `/i/${token}/done` : `/i/${token}`} className="btn btn-primary w-full justify-center">{last ? "Finish" : "Back to your rounds"}</a>
        </div>
      ) : phase === "finishing" ? (
        <p className="text-sm text-text-muted inline-flex items-center gap-2" role="status"><Loader2 className="h-4 w-4 animate-spin" /> Wrapping up this round…</p>
      ) : (
        <div className="space-y-2">
          <label htmlFor="answer" className="sr-only">Your answer</label>
          <textarea
            id="answer"
            className={`input min-h-[110px] text-[15px] ${isCoding ? "font-mono text-sm" : ""}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); } }}
            placeholder={isCoding ? "Explain your approach, then write code or pseudocode." : "Type your answer. Specific examples help."}
            disabled={phase !== "chat"}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            {confirmEnd ? (
              <span className="text-sm inline-flex items-center gap-2">
                End this round now?
                <button type="button" className="underline underline-offset-2 text-hard" onClick={() => roundRunId && finish(roundRunId)}>Yes, end it</button>
                <button type="button" className="text-text-dim" onClick={() => setConfirmEnd(false)}>Keep going</button>
              </span>
            ) : (
              <button type="button" className="text-sm text-text-dim underline underline-offset-2 hover:text-text" onClick={() => setConfirmEnd(true)} disabled={phase !== "chat"}>
                End round early
              </button>
            )}
            <button type="button" className="btn btn-primary" onClick={send} disabled={phase !== "chat" || !draft.trim() || !!unreplied}>
              {phase === "replying" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send
            </button>
          </div>
          <p className="text-xs text-text-dim">
            Ctrl/⌘ + Enter to send.
            {draftState === "saving" && " Saving draft…"}
            {draftState === "saved" && " Draft saved."}
          </p>
        </div>
      )}
    </div>
  );
}
