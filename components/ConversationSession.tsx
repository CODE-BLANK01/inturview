"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, PauseCircle, X } from "lucide-react";
import { TopNav } from "./TopNav";
import { ChatPanel } from "./ChatPanel";
import { Timer } from "./Timer";
import { PauseOverlay } from "./interview/PauseOverlay";
import {
  ConversationDebriefPanel,
  fetchConversationDebrief,
  type DebriefState,
} from "./conversation/ConversationDebriefPanel";
import { EndConversationDialog } from "./conversation/EndConversationDialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { Spinner } from "@/components/ui/Spinner";
import { useTypewriter } from "@/lib/useTypewriter";
import { streamConversationMessage } from "@/lib/stream";
import type { ChatMessage } from "@/lib/types";

export interface ConversationSessionProps {
  kind: "BEHAVIORAL" | "RECRUITER_SCREEN";
  /** For behavioral, the scenario_id; for recruiter screen, undefined. */
  scenarioId?: string;
  /** Human title shown in the header. */
  title: string;
  /** One-line subtitle / category line under the title. */
  subtitle: string;
  /** Prompt shown in the "context card" panel above the chat. */
  prompt: string;
  /** Href to go back to when the user clicks the back arrow. */
  backHref: string;
  /** Label for the back link. */
  backLabel: string;
}

export function ConversationSession({
  kind,
  scenarioId,
  title,
  subtitle,
  prompt,
  backHref,
  backLabel,
}: ConversationSessionProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);

  // Single live thread of chat. The follow-up chat after the debrief lives in
  // ConversationDebriefPanel.
  const [liveMessages, setLiveMessages] = useState<ChatMessage[]>([]);
  const [liveStreaming, setLiveStreaming] = useState(false);
  const liveWriter = useTypewriter(45);

  const [debriefState, setDebriefState] = useState<DebriefState>({ status: "idle" });

  const [timerResumed, setTimerResumed] = useState(false);
  const [paused, setPaused] = useState(false);
  const [endDialogOpen, setEndDialogOpen] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const liveInputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  const pauseSession = useCallback(() => {
    if (debriefState.status !== "idle") return;
    setPaused(true);
  }, [debriefState.status]);

  const resumeSession = useCallback(() => {
    setPaused(false);
  }, []);

  const openEndDialog = useCallback(() => setEndDialogOpen(true), []);
  const closeEndDialog = useCallback(() => setEndDialogOpen(false), []);

  const runLiveTurn = useCallback(
    (id: string, userTurn: string | null) => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      if (userTurn) {
        setLiveMessages((prev) => [...prev, { role: "user", content: userTurn }]);
      }
      liveWriter.reset();
      setLiveStreaming(true);

      let acc = "";
      streamConversationMessage(
        { session_id: id, mode: "live", user_turn: userTurn },
        {
          signal: ac.signal,
          onDelta: (chunk) => {
            acc += chunk;
            liveWriter.append(chunk);
          },
          onDone: () => {
            liveWriter.drain().then(() => {
              setLiveMessages((prev) => [...prev, { role: "assistant", content: acc }]);
              setLiveStreaming(false);
              liveWriter.reset();
            });
          },
          onError: (msg) => {
            liveWriter.drain().then(() => {
              setLiveMessages((prev) => [
                ...prev,
                { role: "assistant", content: acc || `[interviewer disconnected: ${msg}]` },
              ]);
              setLiveStreaming(false);
              liveWriter.reset();
            });
          },
        }
      );
    },
    [liveWriter]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/conversation/start", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            kind,
            ...(scenarioId ? { scenario_id: scenarioId } : {}),
          }),
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

        setTimerResumed(data.resumed);

        if (!data.resumed) {
          setSessionId(data.id);
          runLiveTurn(data.id, null);
          return;
        }

        const detail = await fetch(`/api/conversation-sessions/${data.id}`);
        if (!detail.ok) {
          const j = await detail.json().catch(() => ({}));
          throw new Error(j.error || `Could not load session (${detail.status})`);
        }
        const detailJson = (await detail.json()) as {
          session: {
            messages: { role: "user" | "assistant"; content: string }[];
          };
        };
        if (cancelled) return;

        const s = detailJson.session;
        const msgs: ChatMessage[] = s.messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));
        setLiveMessages(msgs);
        setSessionId(data.id);

        if (msgs.length === 0) runLiveTurn(data.id, null);
      } catch (err) {
        if (cancelled) return;
        setBootError(err instanceof Error ? err.message : "Failed to start session");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, scenarioId]);

  const onLiveSend = (text: string) => {
    if (!sessionId || liveStreaming) return;
    runLiveTurn(sessionId, text);
  };

  const submitForDebrief = async () => {
    if (!sessionId) return;
    abortRef.current?.abort();
    setDebriefState({ status: "loading" });
    setDebriefState(await fetchConversationDebrief(sessionId));
  };

  if (bootError) {
    return (
      <>
        <TopNav />
        <main className="mx-auto max-w-md px-4 py-16">
          <div className="panel p-6 border-hard/40">
            <h1 className="text-lg font-semibold mb-1">Couldn&apos;t start session</h1>
            <p className="text-sm text-text-muted mb-4">{bootError}</p>
            <Link href={backHref} className="btn">
              {backLabel}
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
        <main className="mx-auto max-w-5xl px-4 py-6">
          <Skeleton h={20} w={220} className="mb-5" />
          <div className="panel p-4 flex flex-col items-center justify-center min-h-[60vh] gap-3">
            <Spinner size={20} />
            <p className="text-sm text-text-dim">Setting up your session…</p>
          </div>
        </main>
      </>
    );
  }

  const showingDebrief = debriefState.status !== "idle";

  return (
    <>
      <TopNav />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-5 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Link
              href={backHref}
              className="text-text-dim hover:text-text inline-flex items-center gap-1 text-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              {backLabel}
            </Link>
            <span className="text-text-dim">/</span>
            <span className="text-sm text-text-muted">{title}</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Timer
              sessionId={sessionId}
              resumed={timerResumed}
              paused={showingDebrief || paused}
            />
            {!showingDebrief && (
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

        {!showingDebrief && (
          <div className="space-y-4">
            <section className="panel p-5">
              <div className="text-xs text-text-dim mb-2">{subtitle}</div>
              <h1 className="text-xl font-semibold">{title}</h1>
              <p className="mt-3 text-sm text-text-muted whitespace-pre-wrap">{prompt}</p>
            </section>

            <div className="panel flex flex-col min-h-[55vh]">
              <ChatPanel
                messages={liveMessages}
                streamingText={liveStreaming ? liveWriter.visible : null}
                disabled={liveStreaming}
                onSend={onLiveSend}
                placeholder="Your turn — type your answer as you would say it."
                inputRef={liveInputRef}
                emptyState="The interviewer will start the conversation shortly."
              />
            </div>

            <div className="flex justify-end">
              <button
                className="btn btn-primary"
                onClick={submitForDebrief}
                disabled={liveStreaming || liveMessages.length < 2}
                title={
                  liveMessages.length < 2
                    ? "Have a real exchange before submitting"
                    : "Submit for scorecard"
                }
              >
                Submit for debrief
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {showingDebrief && (
          <ConversationDebriefPanel
            sessionId={sessionId}
            kind={kind}
            state={debriefState}
            onRetry={submitForDebrief}
            backHref={backHref}
            backLabel={backLabel}
          />
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
        <EndConversationDialog sessionId={sessionId} onClose={closeEndDialog} />
      )}
    </>
  );
}
