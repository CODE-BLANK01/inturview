"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Eye, RotateCcw } from "lucide-react";
import { TopNav } from "./TopNav";
import { ChatPanel } from "./ChatPanel";
import { CodeEditor, LANGUAGES, STARTERS, type Language } from "./CodeEditor";
import { DebriefView } from "./DebriefView";
import { PhaseIndicator } from "./PhaseIndicator";
import { ProblemStatement } from "./ProblemStatement";
import { ReadyPrompt } from "./ReadyPrompt";
import { Timer } from "./Timer";
import { Skeleton } from "@/components/ui/Skeleton";
import { Spinner } from "@/components/ui/Spinner";
import { useTypewriter } from "@/lib/useTypewriter";
import { streamInterviewMessage } from "@/lib/stream";
import type { ChatMessage, Debrief, Phase, Problem } from "@/lib/types";

type DebriefState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: Debrief }
  | { status: "error"; message: string };

export function InterviewSession({ problem }: { problem: Problem }) {
  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);

  const [phase, setPhase] = useState<Phase>("approach");

  // Phase 1 (approach) chat
  const [approachMessages, setApproachMessages] = useState<ChatMessage[]>([]);
  const [approachStreaming, setApproachStreaming] = useState(false);
  // True once the interviewer has emitted [READY] for the latest turn. Resets to
  // false at the start of each new turn so the prompt reflects the most recent signal.
  const [approachReady, setApproachReady] = useState(false);
  const approachWriter = useTypewriter(45);

  // Phase 2 (code)
  const [language, setLanguage] = useState<Language>("python");
  const [code, setCode] = useState<string>(STARTERS.python);
  const [codeMessages, setCodeMessages] = useState<ChatMessage[]>([]);
  const [codeStreaming, setCodeStreaming] = useState(false);
  const codeWriter = useTypewriter(45);

  // Phase 3 (debrief follow-up)
  const [debriefState, setDebriefState] = useState<DebriefState>({ status: "idle" });
  const [followUpMessages, setFollowUpMessages] = useState<ChatMessage[]>([]);
  const [followUpStreaming, setFollowUpStreaming] = useState(false);
  const followUpWriter = useTypewriter(45);

  const startedAt = useRef<number>(Date.now());
  const abortRef = useRef<AbortController | null>(null);
  const approachInputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  const aiTurnsInApproach = useMemo(
    () => approachMessages.filter((m) => m.role === "assistant").length,
    [approachMessages]
  );

  // Debounced auto-save: every keystroke the interviewer can see is also persisted
  // so the DB always has the latest code (used by the code-phase system prompt and
  // by history/debrief). 1.2s debounce after the user stops typing.
  useEffect(() => {
    if (!interviewId || phase !== "code") return;
    const t = setTimeout(() => {
      fetch("/api/interview/code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ interview_id: interviewId, code, language }),
        keepalive: true,
      }).catch(() => {
        /* network blip — next keystroke will retry */
      });
    }, 1200);
    return () => clearTimeout(t);
  }, [code, language, interviewId, phase]);

  // Boot: create the Interview row and kick off the approach with no user turn.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/interview/start", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ problem_id: problem.id }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || `Could not start interview (${res.status})`);
        }
        const data = (await res.json()) as { id: string };
        if (cancelled) return;
        setInterviewId(data.id);
        runApproachTurn(data.id, null);
      } catch (err) {
        if (cancelled) return;
        setBootError(err instanceof Error ? err.message : "Failed to start interview");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problem.id]);

  const runApproachTurn = useCallback(
    (id: string, userTurn: string | null) => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      if (userTurn) {
        setApproachMessages((prev) => [...prev, { role: "user", content: userTurn }]);
      }
      // Reset readiness — each new turn must re-establish whether the interviewer
      // is green-lighting. We will flip it back true if a `meta` event with
      // ready:true arrives during the stream.
      setApproachReady(false);
      approachWriter.reset();
      setApproachStreaming(true);

      let acc = "";
      streamInterviewMessage(
        {
          interview_id: id,
          problem_id: problem.id,
          phase: "approach",
          user_turn: userTurn,
        },
        {
          signal: ac.signal,
          onDelta: (chunk) => {
            acc += chunk;
            approachWriter.append(chunk);
          },
          onMeta: (meta) => {
            if (typeof meta.ready === "boolean") setApproachReady(meta.ready);
          },
          onDone: () => {
            approachWriter.drain().then(() => {
              setApproachMessages((prev) => [...prev, { role: "assistant", content: acc }]);
              setApproachStreaming(false);
              approachWriter.reset();
            });
          },
          onError: (msg) => {
            approachWriter.drain().then(() => {
              setApproachMessages((prev) => [
                ...prev,
                { role: "assistant", content: acc || `[interviewer disconnected: ${msg}]` },
              ]);
              setApproachStreaming(false);
              approachWriter.reset();
            });
          },
        }
      );
    },
    [problem.id, approachWriter]
  );

  const onApproachSend = (text: string) => {
    if (!interviewId || approachStreaming) return;
    runApproachTurn(interviewId, text);
  };

  const onCodeSend = (text: string) => {
    if (!interviewId || codeStreaming) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setCodeMessages((prev) => [...prev, { role: "user", content: text }]);
    codeWriter.reset();
    setCodeStreaming(true);

    let acc = "";
    streamInterviewMessage(
      {
        interview_id: interviewId,
        problem_id: problem.id,
        phase: "code",
        user_turn: text,
        user_code: code,
      },
      {
        signal: ac.signal,
        onDelta: (chunk) => {
          acc += chunk;
          codeWriter.append(chunk);
        },
        onDone: () => {
          codeWriter.drain().then(() => {
            setCodeMessages((prev) => [...prev, { role: "assistant", content: acc }]);
            setCodeStreaming(false);
            codeWriter.reset();
          });
        },
        onError: (msg) => {
          codeWriter.drain().then(() => {
            setCodeMessages((prev) => [
              ...prev,
              { role: "assistant", content: acc || `[interviewer disconnected: ${msg}]` },
            ]);
            setCodeStreaming(false);
            codeWriter.reset();
          });
        },
      }
    );
  };

  const onFollowUpSend = (text: string) => {
    if (!interviewId || followUpStreaming) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setFollowUpMessages((prev) => [...prev, { role: "user", content: text }]);
    followUpWriter.reset();
    setFollowUpStreaming(true);

    let acc = "";
    streamInterviewMessage(
      {
        interview_id: interviewId,
        problem_id: problem.id,
        phase: "debrief",
        user_turn: text,
      },
      {
        signal: ac.signal,
        onDelta: (chunk) => {
          acc += chunk;
          followUpWriter.append(chunk);
        },
        onDone: () => {
          followUpWriter.drain().then(() => {
            setFollowUpMessages((prev) => [...prev, { role: "assistant", content: acc }]);
            setFollowUpStreaming(false);
            followUpWriter.reset();
          });
        },
        onError: (msg) => {
          followUpWriter.drain().then(() => {
            setFollowUpMessages((prev) => [
              ...prev,
              { role: "assistant", content: acc || `[error: ${msg}]` },
            ]);
            setFollowUpStreaming(false);
            followUpWriter.reset();
          });
        },
      }
    );
  };

  const submitForDebrief = async () => {
    if (!interviewId || !code.trim()) return;
    abortRef.current?.abort();
    setPhase("debrief");
    setDebriefState({ status: "loading" });
    try {
      const res = await fetch("/api/interview/debrief", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ interview_id: interviewId, user_code: code }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `Request failed (${res.status})` }));
        setDebriefState({ status: "error", message: err.error || "Debrief failed" });
        return;
      }
      const data = (await res.json()) as Debrief;
      setDebriefState({ status: "ready", data });
    } catch (err) {
      setDebriefState({
        status: "error",
        message: err instanceof Error ? err.message : "Network error",
      });
    }
  };

  const onChangeLanguage = (lang: Language) => {
    setLanguage(lang);
    if (!code.trim() || code === STARTERS[language]) {
      setCode(STARTERS[lang]);
    }
  };

  if (bootError) {
    return (
      <>
        <TopNav />
        <main className="mx-auto max-w-md px-4 py-16">
          <div className="panel p-6 border-hard/40">
            <h1 className="text-lg font-semibold mb-1">Couldn&apos;t start interview</h1>
            <p className="text-sm text-text-muted mb-4">{bootError}</p>
            <Link href="/problems" className="btn">
              Back to problems
            </Link>
          </div>
        </main>
      </>
    );
  }

  if (!interviewId) {
    return (
      <>
        <TopNav />
        <main className="mx-auto max-w-7xl px-4 py-6">
          <div className="mb-5 flex items-center justify-between gap-4 flex-wrap">
            <Skeleton h={14} w={120} />
            <Skeleton h={20} w={220} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[70vh]">
            <div className="panel p-5 space-y-3">
              <Skeleton h={22} w={80} className="rounded-full" />
              <Skeleton h={24} className="w-64" />
              <Skeleton h={12} className="w-full" />
              <Skeleton h={12} className="w-5/6" />
              <Skeleton h={12} className="w-2/3" />
            </div>
            <div className="panel p-4 flex flex-col items-center justify-center min-h-[70vh] gap-3">
              <Spinner size={20} />
              <p className="text-sm text-text-muted">Setting up your interview…</p>
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <TopNav />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-5 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Link
              href="/problems"
              className="text-text-dim hover:text-text inline-flex items-center gap-1 text-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              Problems
            </Link>
            <span className="text-text-dim">/</span>
            <span className="text-sm text-text-muted">{problem.title}</span>
          </div>
          <div className="flex items-center gap-4">
            <Timer startedAt={startedAt.current} paused={phase === "debrief"} />
            <PhaseIndicator current={phase} />
          </div>
        </div>

        {phase === "approach" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[70vh]">
            <ProblemStatement problem={problem} />
            <div className="panel flex flex-col min-h-[70vh]">
              <ChatPanel
                messages={approachMessages}
                streamingText={approachStreaming ? approachWriter.visible : null}
                disabled={approachStreaming}
                onSend={onApproachSend}
                placeholder="Walk through your approach…"
                inputRef={approachInputRef}
              />
            </div>
            <div className="lg:col-span-2">
              <ReadyPrompt
                ready={approachReady}
                disabled={approachStreaming}
                followups={aiTurnsInApproach}
                onStartCoding={() => setPhase("code")}
                onSkipAhead={() => {
                  // Persist behavioral flag, then advance.
                  if (interviewId) {
                    fetch("/api/interview/skip-approach", {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ interview_id: interviewId }),
                      keepalive: true,
                    }).catch(() => {
                      /* non-fatal — the debrief route will still see approachAcceptedAt is null */
                    });
                  }
                  setPhase("code");
                }}
                onKeepDiscussing={() => approachInputRef.current?.focus()}
              />
            </div>
          </div>
        )}

        {phase === "code" && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 h-[calc(100vh-180px)] min-h-[600px]">
            <div className="flex flex-col gap-3 min-h-0">
              <ProblemStatement problem={problem} collapsed />
              <div className="panel flex-1 overflow-hidden flex flex-col min-h-0">
                <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
                  <select
                    className="input w-auto py-1 text-xs"
                    value={language}
                    onChange={(e) => onChangeLanguage(e.target.value as Language)}
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-2">
                    <button
                      className="btn"
                      onClick={() => setCode(STARTERS[language])}
                      title="Reset to starter code"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Reset
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={submitForDebrief}
                      disabled={!code.trim()}
                    >
                      Submit Solution
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="flex-1 min-h-0">
                  <CodeEditor value={code} onChange={setCode} language={language} />
                </div>
              </div>
            </div>
            <aside className="panel flex flex-col min-h-0">
              <div className="border-b border-border px-3 py-2 flex items-center justify-between gap-2">
                <span className="text-xs uppercase tracking-wide text-text-dim">
                  Ask the interviewer
                </span>
                <span
                  className="inline-flex items-center gap-1 text-[10px] text-accent"
                  title="The interviewer sees your latest editor contents on every message"
                >
                  <Eye className="h-3 w-3" />
                  Sees your code
                </span>
              </div>
              <ChatPanel
                messages={codeMessages}
                streamingText={codeStreaming ? codeWriter.visible : null}
                disabled={codeStreaming}
                onSend={onCodeSend}
                placeholder="Quick clarifying question…"
                compact
              />
            </aside>
          </div>
        )}

        {phase === "debrief" && (
          <div className="space-y-6">
            {debriefState.status === "loading" && (
              <div className="space-y-6">
                <div className="panel p-5 flex items-center gap-3">
                  <Spinner size={18} />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Compiling your debrief…</p>
                    <p className="text-xs text-text-dim mt-0.5 animate-soft-pulse">
                      Scoring across five dimensions and writing the interviewer summary.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                  <div className="panel p-5 lg:col-span-3 space-y-3">
                    <Skeleton h={18} className="w-40" />
                    <Skeleton h={12} className="w-full" />
                    <Skeleton h={12} className="w-5/6" />
                    <Skeleton h={12} className="w-2/3" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3">
                      <div className="space-y-2">
                        <Skeleton h={12} className="w-24" />
                        <Skeleton h={12} className="w-full" />
                        <Skeleton h={12} className="w-3/4" />
                      </div>
                      <div className="space-y-2">
                        <Skeleton h={12} className="w-28" />
                        <Skeleton h={12} className="w-full" />
                        <Skeleton h={12} className="w-3/4" />
                      </div>
                    </div>
                  </div>
                  <div className="panel p-5 lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                      <Skeleton h={18} className="w-28" />
                      <Skeleton h={22} w={90} className="rounded-full" />
                    </div>
                    <Skeleton h={36} w={80} />
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Skeleton h={10} className="w-32" />
                          <Skeleton h={10} w={28} />
                        </div>
                        <Skeleton h={6} className="w-full" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {debriefState.status === "error" && (
              <div className="panel p-6 border-hard/40">
                <h2 className="text-lg font-semibold mb-1">Debrief failed</h2>
                <p className="text-sm text-text-muted mb-4">{debriefState.message}</p>
                <button className="btn" onClick={submitForDebrief}>
                  Retry
                </button>
              </div>
            )}

            {debriefState.status === "ready" && (
              <>
                <DebriefView debrief={debriefState.data} />
                <section className="panel min-h-[300px] flex flex-col">
                  <div className="border-b border-border px-4 py-2 text-xs uppercase tracking-wide text-text-dim">
                    Follow-up — interview is over, ask anything
                  </div>
                  <ChatPanel
                    messages={followUpMessages}
                    streamingText={followUpStreaming ? followUpWriter.visible : null}
                    disabled={followUpStreaming}
                    onSend={onFollowUpSend}
                    placeholder={`e.g., "What's the optimal approach?"`}
                  />
                </section>
              </>
            )}

            <div className="flex justify-end">
              <Link href="/problems" className="btn">
                Back to problems
              </Link>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
