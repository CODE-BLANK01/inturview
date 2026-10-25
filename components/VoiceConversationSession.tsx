"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Keyboard, Mic, MicOff, PhoneOff, RefreshCw } from "lucide-react";
import { TopNav } from "./TopNav";
import {
  ConversationDebriefPanel,
  fetchConversationDebrief,
  type DebriefState,
} from "./conversation/ConversationDebriefPanel";
import { Spinner } from "@/components/ui/Spinner";
import { useVoiceInterview } from "@/lib/useVoiceInterview";

interface VoiceConversationSessionProps {
  kind: "RECRUITER_SCREEN" | "BEHAVIORAL";
  /** Behavioral only. */
  scenarioId?: string;
  title: string;
  subtitle: string;
  prompt: string;
  backHref: string;
  backLabel: string;
  /** Switches the page to the typed chat (only offered before the call starts). */
  onPreferText: () => void;
}

/** Audio-only interview (recruiter screen or behavioral): talk, then get a debrief. */
export function VoiceConversationSession({
  kind,
  scenarioId,
  title,
  subtitle,
  prompt,
  backHref,
  backLabel,
  onPreferText,
}: VoiceConversationSessionProps) {
  const voice = useVoiceInterview();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [debrief, setDebrief] = useState<DebriefState>({ status: "idle" });

  /** Creates (or resumes) the session, then opens the call. Runs on click so
   *  the browser allows the mic prompt and audio playback. */
  const startCall = async (opts: { fresh?: boolean } = {}) => {
    setStarting(true);
    setStartError(null);
    try {
      let id = opts.fresh ? null : sessionId;
      if (!id) {
        const res = await fetch("/api/conversation/start", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            kind,
            ...(scenarioId ? { scenario_id: scenarioId } : {}),
            voice: true,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
        if (!res.ok || !data.id) throw new Error(data.error || `Could not start session (${res.status})`);
        id = data.id;
        setSessionId(id);
      }
      await voice.start(id);
    } catch (err) {
      setStartError(err instanceof Error ? err.message : "Failed to start session");
    } finally {
      setStarting(false);
    }
  };

  const [finishing, setFinishing] = useState(false);

  const finish = async () => {
    if (!sessionId || finishing) return;
    // Hanging up takes a few seconds: the interviewer writes its notes first.
    setFinishing(true);
    try {
      await voice.end();
    } finally {
      setFinishing(false);
    }
    setDebrief({ status: "loading" });
    setDebrief(await fetchConversationDebrief(sessionId));
  };

  /** Drops a timed-out session and opens a new call (counts toward the monthly cap). */
  const startOver = async () => {
    if (sessionId) {
      await fetch("/api/conversation/abandon", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      }).catch(() => {});
      setSessionId(null);
    }
    await startCall({ fresh: true });
  };

  const retryDebrief = async () => {
    if (!sessionId) return;
    setDebrief({ status: "loading" });
    setDebrief(await fetchConversationDebrief(sessionId));
  };

  const answered = voice.lines.some((l) => l.role === "you");
  const live = voice.phase === "live";
  const error = startError ?? voice.error;

  return (
    <>
      <TopNav />
      <main className="mx-auto max-w-3xl px-4 py-6">
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
          {live && voice.deadlineMs && <Countdown deadlineMs={voice.deadlineMs} />}
        </div>

        {voice.phase === "ended" && sessionId ? (
          <ConversationDebriefPanel
            sessionId={sessionId}
            kind={kind}
            state={debrief}
            onRetry={retryDebrief}
            backHref={backHref}
            backLabel={backLabel}
          />
        ) : (
          <div className="space-y-4">
            <section className="panel p-5">
              <div className="text-xs text-text-dim mb-2">{subtitle} · Voice interview</div>
              <h1 className="text-xl font-semibold">{title}</h1>
              <p className="mt-3 text-sm text-text-muted whitespace-pre-wrap">{prompt}</p>
            </section>

            {error && (
              <div className="panel p-4 border-hard/40 text-sm text-text-muted" role="alert">
                {error}
              </div>
            )}

            {!live ? (
              <section className="panel p-6 flex flex-col items-center text-center gap-4">
                <div className="h-14 w-14 rounded-full bg-bg-inset flex items-center justify-center">
                  <Mic className="h-6 w-6 text-text-muted" aria-hidden />
                </div>
                <div className="max-w-md">
                  <p className="text-sm font-medium">Answer out loud, like a real interview.</p>
                  <p className="text-xs text-text-dim mt-1">
                    Audio only — no camera. The interviewer leads and follows up on what you
                    say. Headphones give the cleanest audio. End the call any time to get your
                    debrief.
                  </p>
                </div>
                {voice.expired ? (
                  // The call's time ran out while away: it can be scored, not resumed.
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button className="btn btn-primary" onClick={finish} disabled={starting}>
                      <PhoneOff className="h-4 w-4" /> Get debrief for that call
                    </button>
                    <button className="btn" onClick={startOver} disabled={starting}>
                      {starting ? <Spinner size={14} /> : <RefreshCw className="h-4 w-4" />}
                      Start a new call
                    </button>
                  </div>
                ) : (
                  <button
                    className="btn btn-primary"
                    onClick={() => startCall()}
                    disabled={starting || voice.phase === "connecting"}
                  >
                    {starting || voice.phase === "connecting" ? (
                      <>
                        <Spinner size={14} /> Connecting…
                      </>
                    ) : sessionId ? (
                      <>
                        <RefreshCw className="h-4 w-4" /> Reconnect
                      </>
                    ) : (
                      <>
                        <Mic className="h-4 w-4" /> Start voice interview
                      </>
                    )}
                  </button>
                )}
                {!sessionId && (
                  <button
                    type="button"
                    onClick={onPreferText}
                    className="inline-flex items-center gap-1.5 text-xs text-text-dim hover:text-text"
                  >
                    <Keyboard className="h-3.5 w-3.5" /> Prefer to type?
                  </button>
                )}
              </section>
            ) : (
              <LiveCall
                voice={voice}
                answered={answered}
                onReconnect={() => startCall()}
                onFinish={finish}
                finishing={finishing}
              />
            )}
          </div>
        )}
      </main>
    </>
  );
}

type Voice = ReturnType<typeof useVoiceInterview>;

function LiveCall({
  voice,
  answered,
  onReconnect,
  onFinish,
  finishing,
}: {
  voice: Voice;
  answered: boolean;
  onReconnect: () => void;
  onFinish: () => void;
  /** Hang-up in progress (the interviewer is writing its notes). */
  finishing: boolean;
}) {
  const dropped = voice.status === "disconnected";
  const label = finishing
    ? "Wrapping up the interview…"
    : dropped
    ? "Connection dropped"
    : voice.status === "speaking"
      ? "Interviewer speaking…"
      : voice.micMuted
        ? "Muted"
        : "Listening";

  // Keep the newest line in view as the conversation grows.
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [voice.lines.length, voice.interviewerLive]);

  return (
    <section className="panel flex flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 text-sm" aria-live="polite">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              dropped ? "bg-hard" : voice.status === "speaking" ? "bg-accent animate-soft-pulse" : "bg-easy"
            }`}
            aria-hidden
          />
          {label}
        </div>
        <div className="flex items-center gap-2">
          {dropped ? (
            <button className="btn" onClick={onReconnect}>
              <RefreshCw className="h-4 w-4" /> Reconnect
            </button>
          ) : (
            <button
              className="btn"
              onClick={voice.toggleMic}
              aria-pressed={voice.micMuted}
              title={voice.micMuted ? "Unmute" : "Mute"}
            >
              {voice.micMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              {voice.micMuted ? "Unmute" : "Mute"}
            </button>
          )}
          <button
            className="btn btn-primary"
            onClick={onFinish}
            disabled={!answered || finishing}
            title={answered ? "End the call and get your debrief" : "Answer at least once first"}
          >
            {finishing ? <Spinner size={14} /> : <PhoneOff className="h-4 w-4" />}
            {finishing ? "Ending…" : "End & debrief"}
          </button>
        </div>
      </div>

      {voice.timeUp && (
        <p className="px-4 pt-3 text-xs text-text-muted">
          Time&apos;s up. End the call to get your debrief.
        </p>
      )}
      {voice.saveFailed && (
        <p className="px-4 pt-3 text-xs text-hard">
          Some of the conversation couldn&apos;t be saved. Your debrief may be missing parts.
        </p>
      )}

      {/* Live captions of both sides. Yours come from a separate speech-to-text
          model, so they can be wrong even when the interviewer understood you. */}
      <p className="px-4 pt-3 text-[11px] text-text-dim">
        Captions are approximate — the interviewer hears your voice, not the captions.
      </p>
      <div className="max-h-[50vh] min-h-[30vh] overflow-y-auto px-4 py-4 space-y-3 text-sm">
        {voice.lines.length === 0 && !voice.interviewerLive && (
          <p className="text-text-dim">The interviewer will start in a moment.</p>
        )}
        {voice.lines.map((line, i) => (
          <Caption key={i} role={line.role} text={line.text} />
        ))}
        {voice.interviewerLive && <Caption role="interviewer" text={voice.interviewerLive} />}
        <div ref={endRef} />
      </div>
    </section>
  );
}

function Caption({ role, text }: { role: "you" | "interviewer"; text: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-text-dim">
        {role === "you" ? "You" : "Interviewer"}
      </div>
      <p className={role === "you" ? "text-text" : "text-text-muted"}>{text}</p>
    </div>
  );
}

/** Time left on the call, from the server-issued deadline. */
function Countdown({ deadlineMs }: { deadlineMs: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const left = Math.max(0, Math.floor((deadlineMs - now) / 1000));
  const mm = Math.floor(left / 60).toString().padStart(2, "0");
  const ss = (left % 60).toString().padStart(2, "0");
  return (
    <span className="text-sm text-text-muted tabular-nums" aria-label="Time remaining">
      {mm}:{ss} left
    </span>
  );
}
