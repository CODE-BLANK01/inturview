"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";

type Msg = { id: string; role: "interviewer" | "candidate"; content: string };

/** One interview round as a conversation. The candidate never sees scores. */
export function LoopRoundChat({
  token, roundIndex, roundCount, title, minutes, isCoding,
}: { token: string; roundIndex: number; roundCount: number; title: string; minutes: number; isCoding: boolean }) {
  const [roundRunId, setRoundRunId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [phase, setPhase] = useState<"loading" | "chat" | "replying" | "finishing" | "done">("loading");
  const [error, setError] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const bottom = useRef<HTMLDivElement>(null);

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
      let body: { roundRunId?: string; status?: string; messages?: Msg[]; pending?: boolean; error?: string } = {};
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
      setRoundRunId(body.roundRunId ?? null);
      setMessages(body.messages ?? []);
      setPhase(body.status === "IN_PROGRESS" ? "chat" : "done");
    })();
    return () => {
      stale = true;
    };
  }, [token, roundIndex]);

  const send = async () => {
    const content = draft.trim();
    if (!content || !roundRunId || phase !== "chat") return;
    setDraft("");
    setError(null);
    setPhase("replying");
    const tempId = `c-${Date.now()}`;
    setMessages((m) => [...m, { id: tempId, role: "candidate", content }, { id: `i-${tempId}`, role: "interviewer", content: "" }]);
    let complete = false;
    try {
      const res = await fetch("/api/i/message", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, roundRunId, content }),
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
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
          if (ev.t) setMessages((m) => m.map((x) => (x.id === `i-${tempId}` ? { ...x, content: x.content + ev.t } : x)));
          if (ev.error) throw new Error(ev.error);
          if (ev.done) complete = !!ev.complete;
        }
      }
      setPhase("chat");
      if (complete) await finish(roundRunId);
    } catch (e) {
      setMessages((m) => m.filter((x) => x.id !== `i-${tempId}`));
      setError(e instanceof Error ? e.message : "Your answer didn't send.");
      setPhase("chat");
    }
  };

  const elapsed = Math.floor((now - startedAt) / 60_000);
  const last = roundIndex === roundCount - 1;
  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-4">
      <header className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="t-eyebrow">Round {roundIndex + 1} of {roundCount}</p>
          <h1 className="t-section-headline text-2xl truncate">{title}</h1>
        </div>
        <span className="text-sm text-text-dim tabular-nums whitespace-nowrap" aria-label="Time in this round">{elapsed} / {minutes} min</span>
      </header>

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
        <div ref={bottom} />
      </div>

      {error && <p className="text-sm text-hard" role="alert">{error}</p>}

      {phase === "done" ? (
        <div className="panel p-5 space-y-3" role="status">
          <p className="font-medium">Round {roundIndex + 1} complete.</p>
          <p className="text-sm text-text-muted">{last ? "That was the last round. Thank you!" : "Take a break if you like. The next round is ready whenever you are."}</p>
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
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void send(); } }}
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
            <button type="button" className="btn btn-primary" onClick={send} disabled={phase !== "chat" || !draft.trim()}>
              {phase === "replying" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send
            </button>
          </div>
          <p className="text-xs text-text-dim">Ctrl/⌘ + Enter to send.</p>
        </div>
      )}
    </div>
  );
}
