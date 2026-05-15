"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { TypingDots } from "@/components/ui/TypingDots";
import type { ChatMessage } from "@/lib/types";

interface ChatPanelProps {
  messages: ChatMessage[];
  /** Streamed-but-not-yet-committed assistant text (already smoothed by useTypewriter). */
  streamingText: string | null;
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
  compact?: boolean;
  /** Optional ref the parent can use to focus the input (e.g. from a "Discuss more" prompt). */
  inputRef?: React.RefObject<HTMLTextAreaElement>;
}

export function ChatPanel({
  messages,
  streamingText,
  onSend,
  disabled,
  placeholder,
  compact,
  inputRef,
}: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, streamingText]);

  const submit = () => {
    const text = draft.trim();
    if (!text || disabled) return;
    onSend(text);
    setDraft("");
  };

  return (
    <div className="flex h-full flex-col">
      <div
        ref={scrollRef}
        className={`flex-1 space-y-3 overflow-y-auto p-4 ${compact ? "text-sm" : ""}`}
      >
        {messages.length === 0 && !streamingText && (
          <div className="text-text-dim text-sm">
            The interviewer will start the conversation shortly.
          </div>
        )}
        {messages.map((m, i) => (
          <Bubble key={i} role={m.role} text={m.content} />
        ))}
        {streamingText !== null && (
          <Bubble role="assistant" text={streamingText} streaming />
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="border-t border-border p-3 flex gap-2"
      >
        <textarea
          ref={inputRef}
          className="input resize-none font-sans"
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder || "Type your message…"}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          disabled={disabled}
        />
        <button
          type="submit"
          className="btn btn-primary self-end"
          disabled={disabled || draft.trim().length === 0}
          aria-label="Send"
        >
          {disabled && streamingText !== null ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </form>
    </div>
  );
}

function Bubble({
  role,
  text,
  streaming,
}: {
  role: "user" | "assistant";
  text: string;
  streaming?: boolean;
}) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 ${
          isUser
            ? "bg-accent text-white"
            : "bg-bg-surface border border-border text-text"
        }`}
      >
        {text ? (
          <>
            {text}
            {streaming && <span className="cursor-blink" aria-hidden />}
          </>
        ) : streaming ? (
          // Streaming has begun but the typewriter hasn't emitted any chars yet —
          // show pulsing dots so the user knows the interviewer is "thinking".
          <TypingDots />
        ) : (
          "…"
        )}
      </div>
    </div>
  );
}
