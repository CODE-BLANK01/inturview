"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChatPanel } from "../ChatPanel";
import { ConversationDebriefView } from "./ConversationDebriefView";
import { Spinner } from "@/components/ui/Spinner";
import { useTypewriter } from "@/lib/useTypewriter";
import { streamConversationMessage } from "@/lib/stream";
import type { ChatMessage } from "@/lib/types";
import type { ConversationDebrief } from "@/lib/conversationTypes";

export type DebriefState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: ConversationDebrief }
  | { status: "error"; message: string };

/** Requests (or re-fetches) the scorecard for a finished conversation. */
export async function fetchConversationDebrief(sessionId: string): Promise<DebriefState> {
  try {
    const res = await fetch("/api/conversation/debrief", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ session_id: sessionId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `Request failed (${res.status})` }));
      return { status: "error", message: err.error || "Debrief failed" };
    }
    return { status: "ready", data: (await res.json()) as ConversationDebrief };
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "Network error" };
  }
}

interface ConversationDebriefPanelProps {
  sessionId: string;
  kind: "BEHAVIORAL" | "RECRUITER_SCREEN";
  state: DebriefState;
  onRetry: () => void;
  backHref: string;
  backLabel: string;
}

/** Debrief loading/error/scorecard, plus the post-interview follow-up chat. */
export function ConversationDebriefPanel({
  sessionId,
  kind,
  state,
  onRetry,
  backHref,
  backLabel,
}: ConversationDebriefPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const writer = useTypewriter(45);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  const onSend = (text: string) => {
    if (streaming) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    writer.reset();
    setStreaming(true);

    let acc = "";
    const finish = (content: string) =>
      writer.drain().then(() => {
        setMessages((prev) => [...prev, { role: "assistant", content }]);
        setStreaming(false);
        writer.reset();
      });

    streamConversationMessage(
      { session_id: sessionId, mode: "followup", user_turn: text },
      {
        signal: ac.signal,
        onDelta: (chunk) => {
          acc += chunk;
          writer.append(chunk);
        },
        onDone: () => finish(acc),
        onError: (msg) => finish(acc || `[error: ${msg}]`),
      }
    );
  };

  return (
    <div className="space-y-6">
      {state.status === "loading" && (
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

      {state.status === "error" && (
        <div className="panel p-6 border-hard/40">
          <h2 className="text-lg font-semibold mb-1">Debrief failed</h2>
          <p className="text-sm text-text-muted mb-4">{state.message}</p>
          <button className="btn" onClick={onRetry}>Retry</button>
        </div>
      )}

      {state.status === "ready" && (
        <>
          <ConversationDebriefView debrief={state.data} kind={kind} />
          <section className="panel min-h-[260px] flex flex-col">
            <div className="border-b border-border px-4 py-2 text-xs uppercase tracking-wide text-text-dim">
              Follow-up — interview is over, ask anything
            </div>
            <ChatPanel
              messages={messages}
              streamingText={streaming ? writer.visible : null}
              disabled={streaming}
              onSend={onSend}
              placeholder={`e.g., "What would a 5/5 answer look like?"`}
              emptyState={
                <>
                  Interview&apos;s over. Ask anything — what a strong answer
                  looks like, where you lost points, phrases to use next time.
                </>
              }
            />
          </section>
        </>
      )}

      <div className="flex justify-end">
        <Link href={backHref} className="btn">{backLabel}</Link>
      </div>
    </div>
  );
}
