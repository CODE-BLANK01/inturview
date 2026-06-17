"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, PauseCircle, X } from "lucide-react";
import { TopNav } from "./TopNav";
import { ChatPanel } from "./ChatPanel";
import { ReadyPrompt } from "./ReadyPrompt";
import { Timer } from "./Timer";
import { PauseOverlay } from "./interview/PauseOverlay";
import { DesignCanvas } from "./design/DesignCanvas";
import { DesignPhaseIndicator } from "./design/DesignPhaseIndicator";
import { DesignDebriefView } from "./design/DesignDebriefView";
import { EndDesignDialog } from "./design/EndDesignDialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { Spinner } from "@/components/ui/Spinner";
import { useTypewriter } from "@/lib/useTypewriter";
import { streamDesignMessage, type DesignPhase } from "@/lib/stream";
import type { SystemDesignProblemDef } from "@/lib/designProblems";
import type { ChatMessage } from "@/lib/types";
import type { DesignDebrief } from "@/lib/designTypes";

type DebriefState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: DesignDebrief }
  | { status: "error"; message: string };

export function DesignSession({ problem }: { problem: SystemDesignProblemDef }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [phase, setPhase] = useState<DesignPhase>("scope");

  // Scope phase chat
  const [scopeMessages, setScopeMessages] = useState<ChatMessage[]>([]);
  const [scopeStreaming, setScopeStreaming] = useState(false);
  const [scopeAccepted, setScopeAccepted] = useState(false);
  const scopeWriter = useTypewriter(45);

  // Design phase chat + canvas
  const [designMessages, setDesignMessages] = useState<ChatMessage[]>([]);
  const [designStreaming, setDesignStreaming] = useState(false);
  const designWriter = useTypewriter(45);
  const [initialCanvas, setInitialCanvas] = useState<{
    elements?: unknown[];
    appState?: Record<string, unknown>;
    files?: Record<string, unknown>;
  } | null>(null);
  const latestSceneRef = useRef<{
    elements: readonly unknown[];
    appState: Record<string, unknown>;
    files: Record<string, unknown>;
  } | null>(null);

  // Debrief follow-up
  const [debriefState, setDebriefState] = useState<DebriefState>({ status: "idle" });
  const [followUpMessages, setFollowUpMessages] = useState<ChatMessage[]>([]);
  const [followUpStreaming, setFollowUpStreaming] = useState(false);
  const followUpWriter = useTypewriter(45);

  const [startedAt, setStartedAt] = useState<number>(0);
  const [paused, setPaused] = useState(false);
  const pausedAtRef = useRef<number | null>(null);
  const [endDialogOpen, setEndDialogOpen] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const scopeInputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  const pauseSession = useCallback(() => {
    if (phase === "debrief") return;
    pausedAtRef.current = Date.now();
    setPaused(true);
  }, [phase]);

  const resumeSession = useCallback(() => {
    if (pausedAtRef.current !== null) {
      const pausedDuration = Date.now() - pausedAtRef.current;
      pausedAtRef.current = null;
      setStartedAt((prev) => prev + pausedDuration);
    }
    setPaused(false);
  }, []);

  const openEndDialog = useCallback(() => setEndDialogOpen(true), []);
  const closeEndDialog = useCallback(() => setEndDialogOpen(false), []);

  const aiTurnsInScope = useMemo(
    () => scopeMessages.filter((m) => m.role === "assistant").length,
    [scopeMessages]
  );

  // Boot: resume existing IN_PROGRESS or create new.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/design/start", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ problem_id: problem.id }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || `Could not start session (${res.status})`);
        }
        const data = (await res.json()) as {
          id: string;
          startedAt: string;
          resumed: boolean;
        };
        if (cancelled) return;

        const persistedStart = new Date(data.startedAt).getTime();
        if (Number.isFinite(persistedStart)) setStartedAt(persistedStart);

        if (!data.resumed) {
          setSessionId(data.id);
          runScopeTurn(data.id, null);
          return;
        }

        const detail = await fetch(`/api/design-sessions/${data.id}`);
        if (!detail.ok) {
          const j = await detail.json().catch(() => ({}));
          throw new Error(j.error || `Could not load session (${detail.status})`);
        }
        const detailJson = (await detail.json()) as {
          session: {
            startedAt: string;
            scopeAcceptedAt: string | null;
            canvasJson: unknown;
            messages: { phase: string; role: "user" | "assistant"; content: string }[];
          };
        };
        if (cancelled) return;

        const s = detailJson.session;
        const sStart = new Date(s.startedAt).getTime();
        if (Number.isFinite(sStart)) setStartedAt(sStart);
        const scopeMsgs: ChatMessage[] = s.messages
          .filter((m) => m.phase === "scope")
          .map((m) => ({ role: m.role, content: m.content }));
        const designMsgs: ChatMessage[] = s.messages
          .filter((m) => m.phase === "design")
          .map((m) => ({ role: m.role, content: m.content }));
        setScopeMessages(scopeMsgs);
        setDesignMessages(designMsgs);
        if (s.scopeAcceptedAt) setScopeAccepted(true);

        if (s.canvasJson && typeof s.canvasJson === "object") {
          setInitialCanvas(s.canvasJson as never);
        }

        const hasDesignActivity =
          designMsgs.length > 0 ||
          (s.canvasJson && typeof s.canvasJson === "object" &&
            Array.isArray((s.canvasJson as { elements?: unknown[] }).elements) &&
            ((s.canvasJson as { elements: unknown[] }).elements.length > 0));
        if (hasDesignActivity) setPhase("design");

        setSessionId(data.id);

        if (scopeMsgs.length === 0) runScopeTurn(data.id, null);
      } catch (err) {
        if (cancelled) return;
        setBootError(err instanceof Error ? err.message : "Failed to start session");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problem.id]);

  const runScopeTurn = useCallback(
    (id: string, userTurn: string | null) => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      if (userTurn) {
        setScopeMessages((prev) => [...prev, { role: "user", content: userTurn }]);
      }
      setScopeAccepted(false);
      scopeWriter.reset();
      setScopeStreaming(true);

      let acc = "";
      streamDesignMessage(
        {
          session_id: id,
          problem_id: problem.id,
          phase: "scope",
          user_turn: userTurn,
        },
        {
          signal: ac.signal,
          onDelta: (chunk) => {
            acc += chunk;
            scopeWriter.append(chunk);
          },
          onMeta: (meta) => {
            if (typeof meta.scoped === "boolean") setScopeAccepted(meta.scoped);
          },
          onDone: () => {
            scopeWriter.drain().then(() => {
              setScopeMessages((prev) => [...prev, { role: "assistant", content: acc }]);
              setScopeStreaming(false);
              scopeWriter.reset();
            });
          },
          onError: (msg) => {
            scopeWriter.drain().then(() => {
              setScopeMessages((prev) => [
                ...prev,
                { role: "assistant", content: acc || `[interviewer disconnected: ${msg}]` },
              ]);
              setScopeStreaming(false);
              scopeWriter.reset();
            });
          },
        }
      );
    },
    [problem.id, scopeWriter]
  );

  const onScopeSend = (text: string) => {
    if (!sessionId || scopeStreaming) return;
    runScopeTurn(sessionId, text);
  };

  const onDesignSend = (text: string) => {
    if (!sessionId || designStreaming) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setDesignMessages((prev) => [...prev, { role: "user", content: text }]);
    designWriter.reset();
    setDesignStreaming(true);

    let acc = "";
    streamDesignMessage(
      {
        session_id: sessionId,
        problem_id: problem.id,
        phase: "design",
        user_turn: text,
      },
      {
        signal: ac.signal,
        onDelta: (chunk) => {
          acc += chunk;
          designWriter.append(chunk);
        },
        onDone: () => {
          designWriter.drain().then(() => {
            setDesignMessages((prev) => [...prev, { role: "assistant", content: acc }]);
            setDesignStreaming(false);
            designWriter.reset();
          });
        },
        onError: (msg) => {
          designWriter.drain().then(() => {
            setDesignMessages((prev) => [
              ...prev,
              { role: "assistant", content: acc || `[interviewer disconnected: ${msg}]` },
            ]);
            setDesignStreaming(false);
            designWriter.reset();
          });
        },
      }
    );
  };

  const onFollowUpSend = (text: string) => {
    if (!sessionId || followUpStreaming) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setFollowUpMessages((prev) => [...prev, { role: "user", content: text }]);
    followUpWriter.reset();
    setFollowUpStreaming(true);

    let acc = "";
    streamDesignMessage(
      {
        session_id: sessionId,
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

  const onSceneChange = useCallback(
    (scene: {
      elements: readonly unknown[];
      appState: Record<string, unknown>;
      files: Record<string, unknown>;
    }) => {
      latestSceneRef.current = scene;
      if (!sessionId) return;
      const payload = JSON.stringify({
        elements: scene.elements,
        // Keep appState minimal — viewBackgroundColor etc — to avoid pulling
        // in collaborator maps / non-serializable things.
        appState: { viewBackgroundColor: scene.appState.viewBackgroundColor ?? "#ffffff" },
        files: scene.files,
      });
      fetch("/api/design/canvas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, canvas: payload }),
        keepalive: true,
      }).catch(() => {});
    },
    [sessionId]
  );

  const submitForDebrief = async () => {
    if (!sessionId) return;
    abortRef.current?.abort();
    setPhase("debrief");
    setDebriefState({ status: "loading" });
    try {
      const res = await fetch("/api/design/debrief", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `Request failed (${res.status})` }));
        setDebriefState({ status: "error", message: err.error || "Debrief failed" });
        return;
      }
      const data = (await res.json()) as DesignDebrief;
      setDebriefState({ status: "ready", data });
    } catch (err) {
      setDebriefState({
        status: "error",
        message: err instanceof Error ? err.message : "Network error",
      });
    }
  };

  if (bootError) {
    return (
      <>
        <TopNav />
        <main className="mx-auto max-w-md px-4 py-16">
          <div className="panel p-6 border-hard/40">
            <h1 className="text-lg font-semibold mb-1">Couldn&apos;t start session</h1>
            <p className="text-sm text-text-muted mb-4">{bootError}</p>
            <Link href="/design-problems" className="btn">
              Back to problems
            </Link>
          </div>
        </main>
      </>
    );
  }

  if (!sessionId) {
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
            </div>
            <div className="panel p-4 flex flex-col items-center justify-center min-h-[70vh] gap-3">
              <Spinner size={20} />
              <p className="text-sm text-text-dim">Setting up your session…</p>
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
              href="/design-problems"
              className="text-text-dim hover:text-text inline-flex items-center gap-1 text-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              Problems
            </Link>
            <span className="text-text-dim">/</span>
            <span className="text-sm text-text-muted">{problem.title}</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Timer startedAt={startedAt} paused={phase === "debrief" || paused} />
            <DesignPhaseIndicator current={phase} />
            {phase !== "debrief" && (
              <div className="flex items-center gap-1.5 border-l border-border pl-3 ml-1">
                <button
                  type="button"
                  onClick={pauseSession}
                  disabled={paused}
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-text-muted hover:text-text hover:bg-bg-inset transition-colors duration-150 disabled:opacity-40"
                  title="Pause the session"
                >
                  <PauseCircle className="h-3.5 w-3.5" />
                  Pause
                </button>
                <button
                  type="button"
                  onClick={openEndDialog}
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-text-muted hover:text-text hover:bg-bg-inset transition-colors duration-150"
                  title="End the session"
                >
                  <X className="h-3.5 w-3.5" />
                  End
                </button>
              </div>
            )}
          </div>
        </div>

        {phase === "scope" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[70vh]">
            <DesignPrompt problem={problem} />
            <div className="panel flex flex-col min-h-[70vh]">
              <ChatPanel
                messages={scopeMessages}
                streamingText={scopeStreaming ? scopeWriter.visible : null}
                disabled={scopeStreaming}
                onSend={onScopeSend}
                placeholder="Clarify requirements — scale, latency, consistency…"
                inputRef={scopeInputRef}
                emptyState="The interviewer will start the conversation shortly."
              />
            </div>
            <div className="lg:col-span-2">
              <ReadyPrompt
                ready={scopeAccepted}
                disabled={scopeStreaming}
                followups={aiTurnsInScope}
                onStartCoding={() => setPhase("design")}
                onSkipAhead={() => {
                  if (sessionId) {
                    fetch("/api/design/skip-scope", {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ session_id: sessionId }),
                      keepalive: true,
                    }).catch(() => {});
                  }
                  setPhase("design");
                }}
                onKeepDiscussing={() => scopeInputRef.current?.focus()}
                labels={{
                  greenLitTitle: "Scope is locked in.",
                  greenLitBody:
                    "Requirements and rough scale look solid — you can start whiteboarding whenever you're ready, or keep refining if you'd like.",
                  advanceLabel: "Start designing",
                  skipPenaltyBody: (
                    <>
                      Jumping to the whiteboard without nailed-down requirements will count
                      against your <span className="font-medium">requirements clarity</span>{" "}
                      and <span className="font-medium">communication</span> scores in the
                      debrief.
                    </>
                  ),
                }}
              />
            </div>
          </div>
        )}

        {phase === "design" && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 h-[calc(100vh-180px)] min-h-[600px]">
            <div className="flex flex-col gap-3 min-h-0">
              <DesignPrompt problem={problem} collapsed />
              <div className="panel flex-1 overflow-hidden flex flex-col min-h-0">
                <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
                  <span className="text-xs uppercase tracking-wide text-text-dim">
                    Whiteboard
                  </span>
                  <button
                    className="btn btn-primary"
                    onClick={submitForDebrief}
                  >
                    Submit Design
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex-1 min-h-0 p-2">
                  <DesignCanvas
                    initialScene={initialCanvas}
                    onSceneChange={onSceneChange}
                  />
                </div>
              </div>
            </div>
            <aside className="panel flex flex-col min-h-0">
              <div className="border-b border-border px-3 py-2 text-xs uppercase tracking-wide text-text-dim">
                Talk through your design
              </div>
              <ChatPanel
                messages={designMessages}
                streamingText={designStreaming ? designWriter.visible : null}
                disabled={designStreaming}
                onSend={onDesignSend}
                placeholder="Explain a trade-off or ask the interviewer…"
                compact
                emptyState={
                  <>
                    Narrate your design as you draw — the interviewer sees the
                    canvas and will probe trade-offs.
                  </>
                }
              />
            </aside>
          </div>
        )}

        {phase === "debrief" && (
          <div className="space-y-6">
            {debriefState.status === "loading" && (
              <div className="panel p-5 flex items-center gap-3">
                <Spinner size={18} />
                <div className="flex-1">
                  <p className="text-sm font-medium">Compiling your debrief…</p>
                  <p className="text-xs text-text-dim mt-0.5 animate-soft-pulse">
                    Scoring across five dimensions and writing the interviewer summary.
                  </p>
                </div>
              </div>
            )}

            {debriefState.status === "error" && (
              <div className="panel p-6 border-hard/40">
                <h2 className="text-lg font-semibold mb-1">Debrief failed</h2>
                <p className="text-sm text-text-muted mb-4">{debriefState.message}</p>
                <button className="btn" onClick={submitForDebrief}>Retry</button>
              </div>
            )}

            {debriefState.status === "ready" && (
              <>
                <DesignDebriefView debrief={debriefState.data} />
                <section className="panel min-h-[300px] flex flex-col">
                  <div className="border-b border-border px-4 py-2 text-xs uppercase tracking-wide text-text-dim">
                    Follow-up — interview is over, ask anything
                  </div>
                  <ChatPanel
                    messages={followUpMessages}
                    streamingText={followUpStreaming ? followUpWriter.visible : null}
                    disabled={followUpStreaming}
                    onSend={onFollowUpSend}
                    placeholder={`e.g., "How would you shard this?"`}
                    emptyState={
                      <>
                        Interview&apos;s over. Ask anything — alternative
                        architectures, deep dives, sharding, consistency,
                        anything you wished you&apos;d explored.
                      </>
                    }
                  />
                </section>
              </>
            )}

            <div className="flex justify-end">
              <Link href="/design-problems" className="btn">
                Back to problems
              </Link>
            </div>
          </div>
        )}
      </main>

      {paused && (
        <PauseOverlay
          onResume={resumeSession}
          onEnd={() => {
            resumeSession();
            openEndDialog();
          }}
        />
      )}
      {endDialogOpen && sessionId && (
        <EndDesignDialog sessionId={sessionId} onClose={closeEndDialog} />
      )}
    </>
  );
}

function DesignPrompt({
  problem,
  collapsed,
}: {
  problem: SystemDesignProblemDef;
  collapsed?: boolean;
}) {
  return (
    <section className={`panel ${collapsed ? "p-3" : "p-5"}`}>
      <div className="flex items-center gap-2 text-xs text-text-dim mb-2">
        <span className="rounded-full bg-bg-inset px-2 py-0.5">{problem.difficulty}</span>
        <span>{problem.topic}</span>
        <span>·</span>
        <span>~{problem.estimatedDurationMinutes} min</span>
      </div>
      <h1 className={collapsed ? "text-base font-semibold" : "text-2xl font-semibold"}>
        {problem.title}
      </h1>
      {!collapsed && (
        <p className="mt-3 text-sm text-text-muted whitespace-pre-wrap">{problem.prompt}</p>
      )}
    </section>
  );
}
