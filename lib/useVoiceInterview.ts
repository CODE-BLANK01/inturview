"use client";

/**
 * React hook that runs one spoken interview session in the browser:
 *
 *   mic → POST /api/conversation/voice-key (ephemeral OpenAI key)
 *       → connectRealtime (WebRTC straight to OpenAI, see lib/realtimeClient.ts)
 *       → every finished turn is saved with POST /api/conversation/turns
 *
 * Audio never touches our servers; only the text transcript does. The server
 * owns the interviewer's instructions (baked into the key) and the time limit.
 *
 * On hang-up the interviewer model writes notes on what the candidate said,
 * from the call's actual audio; they're saved for the debrief, because the
 * speech-to-text transcript often mishears accented or short answers.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  connectRealtime,
  type RealtimeHandle,
  type RealtimeStatus,
  type RealtimeTuning,
  type UserTurn,
} from "./realtimeClient";

export type VoicePhase = "idle" | "connecting" | "live" | "ended";

export interface VoiceLine {
  role: "you" | "interviewer";
  text: string;
}

interface VoiceKeyResponse {
  client_secret: string;
  opening_instruction: string;
  remaining_sec: number;
  /** Pacing notes for the interviewer, due `in_sec` from now. */
  checkpoints: { in_sec: number; note: string }[];
  /** Instruction for the end-of-call interviewer notes. */
  notes_instruction: string;
  transcript: { role: "user" | "assistant"; content: string }[];
}

/**
 * Turn-taking for a conversation. The server ends a segment when the
 * candidate sounds finished (lib/realtimeSession.ts); the browser then waits a
 * little longer before the interviewer replies: 1.2 s after a complete
 * sentence, 3.5 s after one that trails off ("…and then, um"). Speaking again
 * before the interviewer's voice starts withdraws its reply, so a thinking
 * pause doesn't hand over half an answer.
 */
const CONVERSATION_TUNING: Partial<RealtimeTuning> = {
  responseGraceMs: 1200,
  unfinishedGraceMs: 3500,
  reopenLateSpeech: true,
};

/** How long before the end the interviewer is told to start wrapping up. */
const WRAP_UP_WARNING_MS = 3 * 60 * 1000;
/** Longest we wait for in-flight turn saves when the candidate ends the call. */
const SAVE_FLUSH_TIMEOUT_MS = 3000;
/** Longest the hang-up waits for the interviewer's notes. */
const NOTES_TIMEOUT_MS = 10_000;

function describeMicError(err: unknown): string {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError") return "Microphone access was blocked. Allow it in your browser and try again.";
  if (name === "NotFoundError") return "No microphone was found. Plug one in and try again.";
  if (name === "NotReadableError") return "Your microphone is in use by another app.";
  return err instanceof Error ? err.message : "Couldn't access your microphone.";
}

export function useVoiceInterview() {
  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [status, setStatus] = useState<RealtimeStatus>("connecting");
  const [lines, setLines] = useState<VoiceLine[]>([]);
  /** The interviewer's sentence as it is being spoken. */
  const [interviewerLive, setInterviewerLive] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [deadlineMs, setDeadlineMs] = useState<number | null>(null);
  const [timeUp, setTimeUp] = useState(false);
  /** The session's voice time ran out before this connect; it can only be debriefed. */
  const [expired, setExpired] = useState(false);
  const [micMuted, setMicMuted] = useState(false);

  const handleRef = useRef<RealtimeHandle | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timersRef = useRef<number[]>([]);
  const savesRef = useRef(new Set<Promise<void>>());
  const sessionIdRef = useRef<string | null>(null);
  const notesInstructionRef = useRef<string | null>(null);

  /** Closes the call, the mic and the timers. Safe to call more than once. */
  const teardown = useCallback(() => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
    // disconnect() flushes an answer still waiting in the grace buffer.
    handleRef.current?.disconnect();
    handleRef.current = null;
    micRef.current?.getTracks().forEach((t) => t.stop());
    micRef.current = null;
    if (audioRef.current) audioRef.current.srcObject = null;
  }, []);

  useEffect(() => teardown, [teardown]);

  /** Saves one turn; failures are surfaced but never interrupt the call. */
  const saveTurn = useCallback((sessionId: string, role: "user" | "assistant", text: string, turn?: UserTurn) => {
    const save = fetch("/api/conversation/turns", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        role,
        content: text,
        ...(turn ? { segments: turn.segments } : {}),
      }),
    })
      .then((res) => {
        if (!res.ok) setSaveFailed(true);
      })
      .catch(() => setSaveFailed(true))
      .finally(() => savesRef.current.delete(save));
    savesRef.current.add(save);
  }, []);

  const start = useCallback(
    async (sessionId: string) => {
      teardown(); // a reconnect replaces any previous call
      sessionIdRef.current = sessionId;
      notesInstructionRef.current = null;
      setPhase("connecting");
      setError(null);
      setTimeUp(false);
      setExpired(false);
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Voice interviews need a secure (HTTPS) connection.");
        }
        let mic: MediaStream;
        try {
          mic = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          });
        } catch (err) {
          throw new Error(describeMicError(err));
        }
        micRef.current = mic;
        setMicMuted(false);

        const res = await fetch("/api/conversation/voice-key", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ session_id: sessionId }),
        });
        const key = (await res.json().catch(() => ({}))) as Partial<VoiceKeyResponse> & {
          error?: string;
          code?: string;
        };
        if (key.code === "TIME_UP") setExpired(true);
        if (!res.ok || !key.client_secret) {
          throw new Error(key.error || `Couldn't start the voice interviewer (${res.status})`);
        }
        notesInstructionRef.current = key.notes_instruction ?? null;
        setLines(
          (key.transcript ?? []).map((m) => ({
            role: m.role === "user" ? "you" : "interviewer",
            text: m.content,
          }))
        );

        // Created inside the click that started the call, so autoplay is allowed.
        audioRef.current ??= new Audio();
        audioRef.current.autoplay = true;

        handleRef.current = await connectRealtime({
          clientSecret: key.client_secret,
          micStream: mic,
          audioEl: audioRef.current,
          // Built server-side: names the scenario's exact question, or carries
          // the transcript on a reconnect.
          openingInstruction: key.opening_instruction,
          tuning: CONVERSATION_TUNING,
          callbacks: {
            onStatus: setStatus,
            onUserTurn: (turn) => {
              setLines((prev) => [...prev, { role: "you", text: turn.text }]);
              saveTurn(sessionId, "user", turn.text, turn);
            },
            onInterviewerDelta: (delta) => setInterviewerLive((prev) => prev + delta),
            onInterviewerCancelled: () => setInterviewerLive(""),
            onInterviewerTurn: (text) => {
              setInterviewerLive("");
              setLines((prev) => [...prev, { role: "interviewer", text }]);
              saveTurn(sessionId, "assistant", text);
            },
            onError: setError,
          },
        });

        // The server's clock is the source of truth; schedule the nudges from it.
        const remainingMs = Math.max(0, (key.remaining_sec ?? 0) * 1000);
        setDeadlineMs(Date.now() + remainingMs);
        // Pacing notes apply to the interviewer's next reply; they never
        // interrupt the candidate.
        for (const c of key.checkpoints ?? []) {
          timersRef.current.push(
            window.setTimeout(() => handleRef.current?.injectNote(c.note, false), c.in_sec * 1000)
          );
        }
        if (remainingMs > WRAP_UP_WARNING_MS) {
          timersRef.current.push(
            window.setTimeout(
              () => handleRef.current?.injectNote("Interviewer note: three minutes remaining. Start wrapping up.", false),
              remainingMs - WRAP_UP_WARNING_MS
            )
          );
        }
        timersRef.current.push(
          window.setTimeout(() => {
            setTimeUp(true);
            handleRef.current?.injectNote("Time is up. Thank the candidate in one sentence and end the interview.");
          }, remainingMs)
        );
        setPhase("live");
      } catch (err) {
        teardown();
        setError(err instanceof Error ? err.message : "Failed to start the voice interview");
        setPhase("idle");
      }
    },
    [saveTurn, teardown]
  );

  /**
   * Hangs up: first asks the interviewer for its notes (while the call is
   * still open) and saves them, then closes and waits briefly for the last
   * turns to be saved. Without notes the debrief uses the transcript alone.
   */
  const end = useCallback(async () => {
    const handle = handleRef.current;
    const sessionId = sessionIdRef.current;
    if (handle && sessionId && notesInstructionRef.current) {
      // Stop listening, so nothing said now starts another reply.
      micRef.current?.getAudioTracks().forEach((t) => (t.enabled = false));
      const notes = await handle.requestNotes(notesInstructionRef.current, NOTES_TIMEOUT_MS);
      if (notes) {
        await fetch("/api/conversation/voice-notes", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ session_id: sessionId, notes }),
        }).catch(() => {});
      }
    }
    teardown();
    setInterviewerLive("");
    setPhase("ended");
    const pending = Promise.all([...savesRef.current]);
    await Promise.race([pending, new Promise((r) => window.setTimeout(r, SAVE_FLUSH_TIMEOUT_MS))]);
  }, [teardown]);

  const toggleMic = useCallback(() => {
    setMicMuted((muted) => {
      micRef.current?.getAudioTracks().forEach((t) => (t.enabled = muted));
      return !muted;
    });
  }, []);

  return {
    phase,
    status,
    lines,
    interviewerLive,
    error,
    saveFailed,
    deadlineMs,
    timeUp,
    expired,
    micMuted,
    start,
    end,
    toggleMic,
  };
}
