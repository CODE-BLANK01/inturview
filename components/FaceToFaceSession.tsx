"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Camera,
  CameraOff,
  Check,
  Circle,
  Mic,
  MicOff,
  PhoneOff,
  X,
} from "lucide-react";
import { TopNav } from "./TopNav";
import { Timer } from "./Timer";
import { ChatPanel } from "./ChatPanel";
import { ConversationDebriefView } from "./conversation/ConversationDebriefView";
import { EndConversationDialog } from "./conversation/EndConversationDialog";
import { Spinner } from "@/components/ui/Spinner";
import { useTypewriter } from "@/lib/useTypewriter";
import { streamConversationMessage } from "@/lib/stream";
import {
  connectRealtime,
  type RealtimeHandle,
  type RealtimeStatus,
  type UserTurn,
} from "@/lib/realtimeClient";
import {
  BodyLanguageTracker,
  type BodyCalibration,
  type BodyMetrics,
} from "@/lib/bodyLanguage";
import {
  FACE_TO_FACE_LEVELS,
  FACE_TO_FACE_TRACKS,
  LEVEL_LABELS,
  TRACK_LABELS,
  type FaceToFaceLevel,
  type FaceToFaceTrack,
} from "@/lib/faceToFaceQuestions";
import type { ChatMessage } from "@/lib/types";
import type { ConversationDebrief } from "@/lib/conversationTypes";

type Phase = "setup" | "starting" | "live" | "debrief";

interface TranscriptEntry {
  role: "interviewer" | "you";
  text: string;
}

type MediaState =
  | { status: "idle" }
  | { status: "requesting" }
  | { status: "ready"; stream: MediaStream }
  | { status: "error"; message: string };

type DebriefState =
  | { status: "loading" }
  | { status: "ready"; data: ConversationDebrief }
  | { status: "error"; message: string };

type BodyState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; message?: string }
  | { status: "calibrating" }
  | { status: "calibrated" }
  | { status: "skipped" }
  | { status: "error"; message: string };

const DIMENSIONS = [
  { label: "Technical depth", hint: "Correctness and how far under the hood you can go" },
  { label: "Problem solving", hint: "Reasoning from evidence, weighing trade-offs, steady at the edge" },
  { label: "Clarity", hint: "Crisp, concise, easy to follow" },
  { label: "Delivery", hint: "Pace, filler words, pauses" },
  { label: "Body language", hint: "Eye contact, posture, stillness, hands — measured on-device" },
];

const STATUS_STYLE: Record<RealtimeStatus, { label: string; cls: string; pulse?: boolean }> = {
  connecting: {
    label: "Connecting to interviewer",
    cls: "border-medium/40 bg-medium/10 text-medium",
    pulse: true,
  },
  listening: { label: "Listening", cls: "border-easy/40 bg-easy/10 text-easy" },
  speaking: { label: "Interviewer speaking", cls: "border-accent/40 bg-accent/10 text-accent" },
  disconnected: { label: "Disconnected", cls: "border-hard/40 bg-hard-bg/40 text-hard" },
};

const REALTIME_BASE =
  process.env.NEXT_PUBLIC_REALTIME_SERVICE_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

function describeMediaError(err: unknown): string {
  const name = (err as { name?: string })?.name;
  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return "Camera or microphone access was blocked. Allow both in your browser's site settings and try again.";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "No camera or microphone was found on this device.";
    case "NotReadableError":
    case "TrackStartError":
      return "Your camera or microphone is in use by another app. Close it and try again.";
    default:
      return err instanceof Error ? err.message : "Couldn't access your camera and microphone.";
  }
}

function useLocalMedia() {
  const [state, setState] = useState<MediaState>({ status: "idle" });
  const [micMuted, setMicMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  const request = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setState({ status: "error", message: "Camera access needs a secure (HTTPS) connection." });
      return;
    }
    setState({ status: "requesting" });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      setMicMuted(false);
      setCameraOff(false);
      setState({ status: "ready", stream });
    } catch (err) {
      setState({ status: "error", message: describeMediaError(err) });
    }
  }, []);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setState({ status: "idle" });
  }, []);

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    },
    []
  );

  const toggleMic = useCallback(() => {
    setMicMuted((muted) => {
      streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = muted));
      return !muted;
    });
  }, []);

  const toggleCamera = useCallback(() => {
    setCameraOff((off) => {
      streamRef.current?.getVideoTracks().forEach((t) => (t.enabled = off));
      return !off;
    });
  }, []);

  return { state, request, stop, micMuted, cameraOff, toggleMic, toggleCamera };
}

interface StartResponse {
  id: string;
  startedAt: string;
  resumed: boolean;
  token: string;
}

interface RealtimeSessionResponse {
  client_secret: string;
  max_duration_sec: number;
}

const SOCKET_RECONNECT_ATTEMPTS = 5;

export function FaceToFaceSession({ backHref, backLabel }: { backHref: string; backLabel: string }) {
  const media = useLocalMedia();

  const [phase, setPhase] = useState<Phase>("setup");
  const [track, setTrack] = useState<FaceToFaceTrack>("backend");
  const [level, setLevel] = useState<FaceToFaceLevel>("mid");
  const [startError, setStartError] = useState<string | null>(null);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [linkStatus, setLinkStatus] = useState<RealtimeStatus>("connecting");
  const [liveError, setLiveError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [interviewerLive, setInterviewerLive] = useState("");
  const [timeUp, setTimeUp] = useState(false);
  const [endDialogOpen, setEndDialogOpen] = useState(false);

  const [debriefState, setDebriefState] = useState<DebriefState>({ status: "loading" });
  const [followUpMessages, setFollowUpMessages] = useState<ChatMessage[]>([]);
  const [followUpStreaming, setFollowUpStreaming] = useState(false);
  const followUpWriter = useTypewriter(45);
  const abortRef = useRef<AbortController | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);
  const realtimeRef = useRef<RealtimeHandle | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pendingAcksRef = useRef(0);
  const timersRef = useRef<number[]>([]);

  const [bodyState, setBodyState] = useState<BodyState>({ status: "idle" });
  const trackerRef = useRef<BodyLanguageTracker | null>(null);
  const calibrationRef = useRef<BodyCalibration | null>(null);

  useEffect(() => {
    if (media.state.status !== "ready") return;
    const stream = media.state.stream;
    let cancelled = false;
    (async () => {
      try {
        if (!trackerRef.current) {
          setBodyState({ status: "loading" });
          const tracker = await BodyLanguageTracker.load();
          if (cancelled) {
            tracker.dispose();
            return;
          }
          trackerRef.current = tracker;
        }
        trackerRef.current.attach(stream);
        setBodyState((s) => (s.status === "calibrated" ? s : { status: "ready" }));
      } catch (err) {
        if (cancelled) return;
        setBodyState({
          status: "error",
          message:
            err instanceof Error && err.message
              ? `Camera tracking unavailable (${err.message}). This session won't score body language.`
              : "Camera tracking unavailable. This session won't score body language.",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [media.state]);

  useEffect(
    () => () => {
      trackerRef.current?.dispose();
      trackerRef.current = null;
    },
    []
  );

  const calibrateBody = async () => {
    const tracker = trackerRef.current;
    if (!tracker) return;
    setBodyState({ status: "calibrating" });
    const cal = await tracker.calibrate(2000);
    if (!cal) {
      setBodyState({
        status: "ready",
        message: "Couldn't see your face and shoulders clearly. Sit centred with your shoulders in frame, then try again.",
      });
      return;
    }
    calibrationRef.current = cal;
    setBodyState({ status: "calibrated" });
  };

  const skipBody = () => setBodyState({ status: "skipped" });

  const wsClosingRef = useRef(false);
  const outboxRef = useRef<string[]>([]);

  const closeSocket = useCallback(() => {
    wsClosingRef.current = true;
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "status", state: "ended" }));
    }
    ws?.close();
  }, []);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
  }, []);

  const teardownLive = useCallback(() => {
    clearTimers();
    realtimeRef.current?.disconnect();
    realtimeRef.current = null;
    closeSocket();
  }, [clearTimers, closeSocket]);

  useEffect(
    () => () => {
      teardownLive();
      abortRef.current?.abort();
    },
    [teardownLive]
  );

  // Turns are queued while the socket is down and flushed on reconnect, so a
  // service restart mid-interview doesn't silently drop transcript.
  const sendTurn = useCallback(
    (role: "user" | "interviewer", text: string, turn?: UserTurn, body?: BodyMetrics | null) => {
      const payload = JSON.stringify({
        type: "turn",
        role,
        text,
        started_at: turn?.startedAt,
        ended_at: turn?.endedAt,
        segments: turn?.segments ?? [],
        body: body ?? undefined,
      });
      pendingAcksRef.current += 1;
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(payload);
      else outboxRef.current.push(payload);
    },
    []
  );

  const connectSocket = (id: string, token: string) =>
    new Promise<WebSocket>((resolve, reject) => {
      const wsBase = REALTIME_BASE.replace(/^http/, "ws");
      const ws = new WebSocket(`${wsBase}/sessions/${id}/events?token=${encodeURIComponent(token)}`);
      let opened = false;
      ws.onopen = () => {
        opened = true;
        ws.send(JSON.stringify({ type: "hello" }));
        for (const payload of outboxRef.current) ws.send(payload);
        outboxRef.current = [];
        resolve(ws);
      };
      ws.onerror = () => {
        if (!opened) reject(new Error("Couldn't reach the realtime service."));
      };
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data as string) as { type: string; message?: string };
          if (msg.type === "turn_ack" || msg.type === "turn_rejected" || msg.type === "error") {
            pendingAcksRef.current = Math.max(0, pendingAcksRef.current - 1);
          }
          if (msg.type === "error" && msg.message) setLiveError(msg.message);
        } catch {}
      };
      ws.onclose = () => {
        if (wsRef.current === ws) wsRef.current = null;
        if (opened && !wsClosingRef.current) scheduleReconnect(id, token, 0);
      };
    });

  const scheduleReconnect = (id: string, token: string, attempt: number) => {
    if (attempt >= SOCKET_RECONNECT_ATTEMPTS) {
      setLiveError(
        "Lost the connection that saves your transcript. Answers from now on won't be scored — finish the interview to keep what was saved."
      );
      return;
    }
    timersRef.current.push(
      window.setTimeout(async () => {
        if (wsClosingRef.current) return;
        try {
          wsRef.current = await connectSocket(id, token);
          setLiveError(null);
        } catch {
          scheduleReconnect(id, token, attempt + 1);
        }
      }, 1000 * 2 ** attempt)
    );
  };

  const startInterview = async () => {
    if (media.state.status !== "ready" || !audioRef.current) return;
    setStartError(null);
    setPhase("starting");

    try {
      const startRes = await fetch("/api/face-to-face/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ track, level }),
      });
      if (!startRes.ok) {
        const j = await startRes.json().catch(() => ({}));
        throw new Error(j.error || `Could not start session (${startRes.status})`);
      }
      const start = (await startRes.json()) as StartResponse;

      let prior: TranscriptEntry[] = [];
      if (start.resumed) {
        const detail = await fetch(`/api/conversation-sessions/${start.id}`);
        if (detail.ok) {
          const j = (await detail.json()) as {
            session: { messages: { role: "user" | "assistant"; content: string }[] };
          };
          prior = j.session.messages.map((m) => ({
            role: m.role === "assistant" ? "interviewer" : "you",
            text: m.content,
          }));
        }
      }

      const rtRes = await fetch(`${REALTIME_BASE}/sessions/${start.id}/realtime`, {
        method: "POST",
        headers: { Authorization: `Bearer ${start.token}` },
      });
      if (!rtRes.ok) {
        const j = await rtRes.json().catch(() => ({}));
        throw new Error(j.detail || j.error || `Realtime service error (${rtRes.status})`);
      }
      const rt = (await rtRes.json()) as RealtimeSessionResponse;

      wsClosingRef.current = false;
      outboxRef.current = [];
      pendingAcksRef.current = 0;
      wsRef.current = await connectSocket(start.id, start.token);

      realtimeRef.current = await connectRealtime({
        clientSecret: rt.client_secret,
        micStream: media.state.stream,
        audioEl: audioRef.current,
        openingInstruction: start.resumed
          ? "Speak only in English. The session is resuming after an interruption. Briefly welcome the candidate back and continue from where the transcript left off."
          : undefined,
        callbacks: {
          onStatus: setLinkStatus,
          onUserTurn: (turn) => {
            setTranscript((prev) => [...prev, { role: "you", text: turn.text }]);
            const cal = calibrationRef.current;
            const body =
              cal && trackerRef.current
                ? trackerRef.current.window(turn.startedAt, turn.endedAt, cal)
                : null;
            sendTurn("user", turn.text, turn, body);
          },
          onInterviewerDelta: (delta) => setInterviewerLive((prev) => prev + delta),
          onInterviewerTurn: (text) => {
            setInterviewerLive("");
            setTranscript((prev) => [...prev, { role: "interviewer", text }]);
            sendTurn("interviewer", text);
          },
          onError: (message) => setLiveError(message),
        },
      });

      const persistedStart = new Date(start.startedAt).getTime();
      const startMs = Number.isFinite(persistedStart) ? persistedStart : Date.now();
      setStartedAt(startMs);
      setSessionId(start.id);
      setTranscript(prior);
      setPhase("live");

      const remainingMs = Math.max(0, startMs + rt.max_duration_sec * 1000 - Date.now());
      const warnMs = remainingMs - 5 * 60 * 1000;
      if (warnMs > 0) {
        timersRef.current.push(
          window.setTimeout(() => {
            realtimeRef.current?.injectNote(
              "Interviewer note: five minutes remaining. Begin wrapping up.",
              false
            );
          }, warnMs)
        );
      }
      timersRef.current.push(
        window.setTimeout(() => {
          setTimeUp(true);
          realtimeRef.current?.injectNote(
            "Time is up. Thank the candidate and end the interview now."
          );
        }, remainingMs)
      );
    } catch (err) {
      teardownLive();
      setStartError(err instanceof Error ? err.message : "Failed to start the interview");
      setPhase("setup");
    }
  };

  const finishInterview = async () => {
    if (!sessionId) return;
    setPhase("debrief");
    setDebriefState({ status: "loading" });

    clearTimers();
    // disconnect() flushes an answer still in the grace buffer, so it must run
    // while the socket is up and the body tracker is still alive.
    realtimeRef.current?.disconnect();
    realtimeRef.current = null;

    const deadline = Date.now() + 3000;
    while (pendingAcksRef.current > 0 && wsRef.current && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 100));
    }

    closeSocket();
    media.stop();
    trackerRef.current?.dispose();
    trackerRef.current = null;

    await loadDebrief();
  };

  const loadDebrief = async () => {
    if (!sessionId) return;
    setDebriefState({ status: "loading" });
    try {
      const res = await fetch("/api/conversation/debrief", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `Request failed (${res.status})` }));
        setDebriefState({ status: "error", message: err.error || "Debrief failed" });
        return;
      }
      setDebriefState({ status: "ready", data: (await res.json()) as ConversationDebrief });
    } catch (err) {
      setDebriefState({
        status: "error",
        message: err instanceof Error ? err.message : "Network error",
      });
    }
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
    streamConversationMessage(
      { session_id: sessionId, mode: "followup", user_turn: text },
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

  const canFinish = transcript.length >= 2;

  return (
    <>
      <TopNav />
      <audio ref={audioRef} autoPlay hidden />
      <main className="mx-auto max-w-6xl px-4 py-6">
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
            <span className="text-sm text-text-muted">Face-to-face interview</span>
          </div>
          {(phase === "live" || phase === "debrief") && (
            <div className="flex items-center gap-3 flex-wrap">
              {phase === "live" && <StatusPill status={linkStatus} />}
              <Timer startedAt={startedAt} paused={phase === "debrief"} />
              {phase === "live" && (
                <div className="flex items-center gap-1.5 border-l border-border pl-3 ml-1">
                  <button
                    type="button"
                    onClick={() => setEndDialogOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-text-muted hover:text-text hover:bg-bg-inset transition-colors duration-150"
                    title="End the session"
                  >
                    <X className="h-3.5 w-3.5" />
                    End
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {(phase === "setup" || phase === "starting") && (
          <SetupView
            media={media}
            track={track}
            level={level}
            onTrack={setTrack}
            onLevel={setLevel}
            starting={phase === "starting"}
            error={startError}
            onStart={startInterview}
            bodyState={bodyState}
            onCalibrate={calibrateBody}
            onSkipBody={skipBody}
          />
        )}

        {phase === "live" && media.state.status === "ready" && (
          <div className="space-y-4">
            {liveError && (
              <div className="rounded-md border border-hard/40 bg-hard-bg/30 text-hard text-sm px-3 py-2">
                {liveError}
              </div>
            )}
            {timeUp && (
              <div className="rounded-md border border-medium/40 bg-medium/10 text-medium text-sm px-3 py-2">
                Time&apos;s up — the interviewer is wrapping. Click Finish when they&apos;re done.
              </div>
            )}
            <LiveView
              stream={media.state.stream}
              micMuted={media.micMuted}
              cameraOff={media.cameraOff}
              onToggleMic={media.toggleMic}
              onToggleCamera={media.toggleCamera}
              onEnd={() => setEndDialogOpen(true)}
              linkStatus={linkStatus}
              transcript={transcript}
              interviewerLive={interviewerLive}
            />
            <div className="flex justify-end">
              <button
                type="button"
                className="btn btn-primary"
                onClick={finishInterview}
                disabled={!canFinish}
                title={canFinish ? "Finish and get your scorecard" : "Have a real exchange before finishing"}
              >
                Finish interview
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
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
                    Scoring across five dimensions and reading your delivery metrics.
                  </p>
                </div>
              </div>
            )}

            {debriefState.status === "error" && (
              <div className="panel p-6 border-hard/40">
                <h2 className="text-lg font-semibold mb-1">Debrief failed</h2>
                <p className="text-sm text-text-muted mb-4">{debriefState.message}</p>
                <button className="btn" onClick={loadDebrief}>Retry</button>
              </div>
            )}

            {debriefState.status === "ready" && (
              <>
                <ConversationDebriefView debrief={debriefState.data} kind="FACE_TO_FACE" />
                <section className="panel min-h-[260px] flex flex-col">
                  <div className="border-b border-border px-4 py-2 text-xs uppercase tracking-wide text-text-dim">
                    Follow-up — interview is over, ask anything
                  </div>
                  <ChatPanel
                    messages={followUpMessages}
                    streamingText={followUpStreaming ? followUpWriter.visible : null}
                    disabled={followUpStreaming}
                    onSend={onFollowUpSend}
                    placeholder={`e.g., "What should I have said about indexes?"`}
                    emptyState={
                      <>
                        Interview&apos;s over. Ask anything — what a strong answer looked
                        like, where you lost points, how to tighten your delivery.
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
        )}
      </main>

      {endDialogOpen && sessionId && (
        <EndConversationDialog sessionId={sessionId} onClose={() => setEndDialogOpen(false)} />
      )}
    </>
  );
}

function SetupView({
  media,
  track,
  level,
  onTrack,
  onLevel,
  starting,
  error,
  onStart,
  bodyState,
  onCalibrate,
  onSkipBody,
}: {
  media: ReturnType<typeof useLocalMedia>;
  track: FaceToFaceTrack;
  level: FaceToFaceLevel;
  onTrack: (t: FaceToFaceTrack) => void;
  onLevel: (l: FaceToFaceLevel) => void;
  starting: boolean;
  error: string | null;
  onStart: () => void;
  bodyState: BodyState;
  onCalibrate: () => void;
  onSkipBody: () => void;
}) {
  const ready = media.state.status === "ready";
  const bodyDone =
    bodyState.status === "calibrated" ||
    bodyState.status === "skipped" ||
    bodyState.status === "error";
  const canStart = ready && bodyDone && !starting;
  const startTitle = !ready
    ? "Enable your camera and mic first"
    : !bodyDone
      ? "Calibrate body language first (two seconds)"
      : "Start the interview";

  return (
    <div className="space-y-4">
      <section className="panel p-5">
        <div className="text-xs text-text-dim mb-2">Live technical round · ~20 minutes</div>
        <h1 className="text-xl font-semibold">Face-to-face interview</h1>
        <p className="mt-3 text-sm text-text-muted">
          A live technical interview over video. The interviewer asks about your stack, digs
          into how things work under the hood, and keeps following up until you reach the
          edge of what you know. You answer out loud — no typing. You&apos;re scored on what
          you say and how you say it: depth, clarity, pace, and body language. Camera
          tracking runs on your device; no video is uploaded.
        </p>
      </section>

      {error && (
        <div className="rounded-md border border-hard/40 bg-hard-bg/30 text-hard text-sm px-3 py-2">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-4">
        <section className="panel p-4 flex flex-col gap-4">
          <div className="t-eyebrow">Camera check</div>

          {media.state.status === "idle" && (
            <div className="flex-1 min-h-[280px] rounded-lg border border-dashed border-border-strong flex flex-col items-center justify-center gap-3 text-center px-6">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-md border bg-accent/15 border-accent/30 text-accent">
                <Camera className="h-5 w-5" />
              </span>
              <p className="text-sm text-text-muted max-w-sm">
                Turn on your camera and microphone to preview how the interviewer will see
                and hear you.
              </p>
              <button type="button" className="btn btn-primary" onClick={media.request}>
                Enable camera &amp; mic
              </button>
            </div>
          )}

          {media.state.status === "requesting" && (
            <div className="flex-1 min-h-[280px] rounded-lg border border-dashed border-border-strong flex flex-col items-center justify-center gap-3">
              <Spinner size={20} />
              <p className="text-sm text-text-dim">Waiting for your permission…</p>
            </div>
          )}

          {media.state.status === "error" && (
            <div className="flex-1 min-h-[280px] rounded-lg border border-hard/40 bg-hard-bg/20 flex flex-col items-center justify-center gap-3 text-center px-6">
              <AlertTriangle className="h-5 w-5 text-hard" />
              <p className="text-sm text-text-muted max-w-sm">{media.state.message}</p>
              <button type="button" className="btn" onClick={media.request}>
                Try again
              </button>
            </div>
          )}

          {media.state.status === "ready" && (
            <>
              <SelfView
                stream={media.state.stream}
                cameraOff={media.cameraOff}
                className="aspect-video w-full"
              />
              <div className="flex items-center justify-between gap-3 flex-wrap text-sm">
                <div className="flex items-center gap-4">
                  <span className="inline-flex items-center gap-1.5 text-text-muted">
                    <Camera className="h-4 w-4 text-easy" />
                    Camera on
                  </span>
                  <span className="inline-flex items-center gap-2 text-text-muted">
                    <Mic className="h-4 w-4 text-easy" />
                    <MicLevel stream={media.state.stream} muted={media.micMuted} />
                  </span>
                </div>
                <span className="text-xs text-text-dim">Say something — the bars should move.</span>
              </div>
              <BodyCalibrationRow state={bodyState} onCalibrate={onCalibrate} onSkip={onSkipBody} />
            </>
          )}
        </section>

        <section className="panel p-5 flex flex-col gap-5">
          <div>
            <div className="t-eyebrow mb-3">Your round</div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                <span className="block text-xs text-text-dim mb-1">Track</span>
                <select
                  className="input"
                  value={track}
                  onChange={(e) => onTrack(e.target.value as FaceToFaceTrack)}
                  disabled={starting}
                >
                  {FACE_TO_FACE_TRACKS.map((t) => (
                    <option key={t} value={t}>
                      {TRACK_LABELS[t]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="block text-xs text-text-dim mb-1">Level</span>
                <select
                  className="input"
                  value={level}
                  onChange={(e) => onLevel(e.target.value as FaceToFaceLevel)}
                  disabled={starting}
                >
                  {FACE_TO_FACE_LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {LEVEL_LABELS[l]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div>
            <div className="t-eyebrow mb-3">Before you start</div>
            <ul className="space-y-2.5 text-sm">
              <CheckItem done={ready} label="Camera is on and you're in frame" />
              <CheckItem done={ready} label="Microphone is on and picking you up" />
              <CheckItem
                done={bodyState.status === "calibrated"}
                label="Body language calibrated — two seconds looking at the lens"
              />
              <CheckItem label="Quiet room, headphones if you have them, shoulders in frame" />
            </ul>
          </div>

          <div>
            <div className="t-eyebrow mb-3">How it works</div>
            <ol className="space-y-2 text-sm text-text-muted list-decimal pl-4">
              <li>The interviewer greets you and opens with a technical question.</li>
              <li>Talk through your reasoning out loud. You can interrupt — it&apos;s a conversation, not a form.</li>
              <li>Finish when you&apos;re wrapped up and get a five-dimension scorecard.</li>
            </ol>
          </div>

          <div>
            <div className="t-eyebrow mb-3">You&apos;re scored on</div>
            <div className="flex flex-wrap gap-1.5">
              {DIMENSIONS.map((d) => (
                <span
                  key={d.label}
                  className="badge border-border bg-bg-surface text-text-muted"
                  title={d.hint}
                >
                  {d.label}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-auto pt-2">
            <button
              type="button"
              className="btn btn-primary w-full"
              onClick={onStart}
              disabled={!canStart}
              title={startTitle}
            >
              {starting ? (
                <>
                  <Spinner size={16} />
                  Connecting…
                </>
              ) : (
                <>
                  Start interview
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function BodyCalibrationRow({
  state,
  onCalibrate,
  onSkip,
}: {
  state: BodyState;
  onCalibrate: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="rounded-md border border-border bg-bg-inset/40 px-3 py-2.5 text-sm">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          {state.status === "loading" || state.status === "calibrating" ? (
            <Spinner size={14} />
          ) : state.status === "calibrated" ? (
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-easy/15 text-easy shrink-0">
              <Check className="h-3 w-3" />
            </span>
          ) : state.status === "error" ? (
            <AlertTriangle className="h-4 w-4 text-medium shrink-0" />
          ) : (
            <Circle className="h-4 w-4 text-text-dim shrink-0" />
          )}
          <span className="text-text-muted">
            {state.status === "idle" && "Body language tracking"}
            {state.status === "loading" && "Loading camera tracking…"}
            {state.status === "ready" && "Look straight at the camera lens — not the screen — and hold still."}
            {state.status === "calibrating" && "Hold still, keep looking at the lens…"}
            {state.status === "calibrated" && "Body language calibrated."}
            {state.status === "skipped" && "Body language won't be scored this session."}
            {state.status === "error" && state.message}
          </span>
        </div>
        {(state.status === "ready" || state.status === "calibrated" || state.status === "skipped") && (
          <button
            type="button"
            className={state.status === "ready" ? "btn text-xs" : "btn btn-ghost text-xs"}
            onClick={onCalibrate}
          >
            {state.status === "ready" ? "Calibrate (2s)" : "Redo"}
          </button>
        )}
      </div>
      {state.status === "ready" && state.message && (
        <p className="mt-1.5 text-xs text-medium">
          {state.message}{" "}
          <button type="button" className="underline hover:text-text" onClick={onSkip}>
            Skip body language
          </button>
        </p>
      )}
    </div>
  );
}

function LiveView({
  stream,
  micMuted,
  cameraOff,
  onToggleMic,
  onToggleCamera,
  onEnd,
  linkStatus,
  transcript,
  interviewerLive,
}: {
  stream: MediaStream;
  micMuted: boolean;
  cameraOff: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onEnd: () => void;
  linkStatus: RealtimeStatus;
  transcript: TranscriptEntry[];
  interviewerLive: string;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-4">
      <section className="panel p-3 flex flex-col gap-3">
        <div className="relative">
          <SelfView stream={stream} cameraOff={cameraOff} className="aspect-video w-full" />
          <InterviewerTile status={linkStatus} />
          {micMuted && (
            <span className="absolute bottom-3 right-3 badge border-hard/40 bg-hard-bg/80 text-hard">
              <MicOff className="h-3 w-3 mr-1" />
              Muted
            </span>
          )}
        </div>

        <div className="flex items-center justify-center gap-2">
          <ControlButton
            active={!micMuted}
            onClick={onToggleMic}
            label={micMuted ? "Unmute" : "Mute"}
            icon={micMuted ? MicOff : Mic}
          />
          <ControlButton
            active={!cameraOff}
            onClick={onToggleCamera}
            label={cameraOff ? "Camera on" : "Camera off"}
            icon={cameraOff ? CameraOff : Camera}
          />
          <button
            type="button"
            onClick={onEnd}
            className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm t-cta transition-colors duration-150"
            style={{
              background: "rgb(var(--score-no))",
              color: "rgb(var(--text-inverse))",
            }}
            title="End the session"
          >
            <PhoneOff className="h-4 w-4" />
            End
          </button>
        </div>
      </section>

      <TranscriptPanel entries={transcript} interviewerLive={interviewerLive} />
    </div>
  );
}

function SelfView({
  stream,
  cameraOff,
  className,
}: {
  stream: MediaStream;
  cameraOff: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream;
    el.play().catch(() => {});
  }, [stream]);

  return (
    <div
      className={`relative overflow-hidden rounded-lg ${className ?? ""}`}
      style={{ background: "rgb(14 12 10)" }}
    >
      <video
        ref={ref}
        autoPlay
        muted
        playsInline
        className={`h-full w-full object-cover -scale-x-100 ${cameraOff ? "invisible" : ""}`}
      />
      {cameraOff && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm"
          style={{ color: "rgb(240 235 227 / 0.7)" }}
        >
          <CameraOff className="h-6 w-6" />
          Camera off
        </div>
      )}
    </div>
  );
}

function InterviewerTile({ status }: { status: RealtimeStatus }) {
  const speaking = status === "speaking";
  return (
    <div className="absolute top-3 left-3 panel px-3 py-2 flex items-center gap-2.5 shadow-lg">
      <span className="relative inline-flex h-8 w-8 items-center justify-center">
        {speaking && (
          <span className="absolute inset-0 rounded-full bg-accent/30 animate-ping" />
        )}
        <span
          className={`relative inline-flex h-8 w-8 items-center justify-center rounded-full border text-xs t-data ${
            speaking
              ? "bg-accent/15 border-accent/40 text-accent"
              : "bg-bg-inset border-border text-text-muted"
          }`}
        >
          I
        </span>
      </span>
      <div className="min-w-0">
        <div className="text-sm font-medium leading-tight">Interviewer</div>
        <div className="text-xs text-text-dim leading-tight">{STATUS_STYLE[status].label}</div>
      </div>
    </div>
  );
}

function TranscriptPanel({
  entries,
  interviewerLive,
}: {
  entries: TranscriptEntry[];
  interviewerLive: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries, interviewerLive]);

  return (
    <section className="panel flex flex-col min-h-[320px] lg:min-h-0">
      <div className="border-b border-border px-4 py-2 text-xs uppercase tracking-wide text-text-dim">
        Live transcript
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
        {entries.length === 0 && !interviewerLive && (
          <p className="text-text-dim">
            Captions appear here as the conversation happens. The interviewer will greet you
            once connected.
          </p>
        )}
        {entries.map((e, i) => (
          <div key={i}>
            <div className={`t-eyebrow mb-1 ${e.role === "you" ? "text-accent" : ""}`}>
              {e.role === "you" ? "You" : "Interviewer"}
            </div>
            <p className="whitespace-pre-wrap text-text">{e.text}</p>
          </div>
        ))}
        {interviewerLive && (
          <div>
            <div className="t-eyebrow mb-1">Interviewer</div>
            <p className="whitespace-pre-wrap text-text">
              {interviewerLive}
              <span className="cursor-blink" aria-hidden />
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

const MIC_BARS = 14;

function MicLevel({ stream, muted }: { stream: MediaStream; muted: boolean }) {
  const [litBars, setLitBars] = useState(0);

  useEffect(() => {
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const buf = new Uint8Array(analyser.fftSize);
    let raf = 0;
    let last = -1;

    const tick = () => {
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i]! - 128) / 128;
        sum += v * v;
      }
      const lit = Math.round(Math.min(1, Math.sqrt(sum / buf.length) * 4) * MIC_BARS);
      if (lit !== last) {
        last = lit;
        setLitBars(lit);
      }
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      source.disconnect();
      ctx.close().catch(() => {});
    };
  }, [stream]);

  const bars = MIC_BARS;
  const lit = muted ? 0 : litBars;

  return (
    <span className="inline-flex items-end gap-0.5 h-4" aria-label="Microphone level">
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className={`w-1 rounded-sm transition-colors duration-75 ${
            i < lit ? "bg-easy" : "bg-bg-inset"
          }`}
          style={{ height: `${40 + (i / bars) * 60}%` }}
        />
      ))}
    </span>
  );
}

function StatusPill({ status }: { status: RealtimeStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span className={`badge ${s.cls} ${s.pulse ? "animate-soft-pulse" : ""}`}>
      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />
      {s.label}
    </span>
  );
}

function ControlButton({
  active,
  onClick,
  label,
  icon: Icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`btn ${active ? "" : "border-hard/40 bg-hard-bg/30 text-hard hover:bg-hard-bg/40"}`}
      title={label}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function CheckItem({ done, label }: { done?: boolean; label: string }) {
  return (
    <li className="flex items-start gap-2">
      {done === undefined ? (
        <Circle className="h-4 w-4 mt-0.5 text-text-dim shrink-0" />
      ) : done ? (
        <span className="inline-flex h-4 w-4 mt-0.5 items-center justify-center rounded-full bg-easy/15 text-easy shrink-0">
          <Check className="h-3 w-3" />
        </span>
      ) : (
        <Circle className="h-4 w-4 mt-0.5 text-border-strong shrink-0" />
      )}
      <span className={done === false ? "text-text-dim" : "text-text-muted"}>{label}</span>
    </li>
  );
}
