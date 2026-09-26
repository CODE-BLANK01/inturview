/**
 * Browser-side client for the live face-to-face round.
 *
 * Audio goes browser <-> OpenAI directly over WebRTC (lowest latency; OpenAI
 * handles echo cancellation and playback). This module owns the three things
 * that make the session robust to a sensitive VAD:
 *
 *   1. A Web Audio noise gate in front of the outbound track — breathing and
 *      keyboard noise never leave the machine.
 *   2. Manual response creation: the session is minted with
 *      create_response=false, so the model only speaks when we send
 *      response.create — and we only do that after a transcript arrives and
 *      passes isUsableTranscript().
 *   3. Barge-in decided from speech duration, not from any VAD blip.
 */

export type RealtimeStatus = "connecting" | "listening" | "speaking" | "disconnected";

export interface Segment {
  start: number;
  end: number;
}

export interface UserTurn {
  text: string;
  startedAt: number;
  endedAt: number;
  segments: Segment[];
}

export interface RealtimeTuning {
  /** How long to wait after a transcript lands before letting the model reply (ms). */
  responseGraceMs: number;
  /** Longer wait used instead when the answer so far looks cut off mid-thought (ms). */
  unfinishedGraceMs: number;
  /** Speech shorter than this while the model is talking is ignored, not treated as barge-in (ms). */
  interruptMinMs: number;
  /** Absolute RMS floor below which the gate never opens. */
  gateMinRms: number;
  /** Gate opens at (measured room floor × this). */
  gateFloorMultiplier: number;
  /** Extra multiplier applied while the interviewer is speaking (speaker bleed). */
  gateSpeakingMultiplier: number;
  /** How long the signal must stay below threshold before the gate closes (ms). */
  gateReleaseMs: number;
  /** Outgoing audio is delayed by this much so the gate opens before speech onset (ms). */
  gatePrerollMs: number;
}

export const DEFAULT_TUNING: RealtimeTuning = {
  responseGraceMs: 1200,
  unfinishedGraceMs: 3500,
  interruptMinMs: 700,
  gateMinRms: 0.012,
  gateFloorMultiplier: 3,
  gateSpeakingMultiplier: 2,
  // Long enough to bridge the natural gaps between words and phrases; 250 ms
  // closed the gate mid-sentence and chopped answers into fragments.
  gateReleaseMs: 900,
  gatePrerollMs: 250,
};

export interface RealtimeCallbacks {
  onStatus: (status: RealtimeStatus) => void;
  onUserTurn: (turn: UserTurn) => void;
  onInterviewerTurn: (text: string) => void;
  onInterviewerDelta?: (text: string) => void;
  onError: (message: string) => void;
}

export interface RealtimeHandle {
  /** Flushes any answer still in the grace buffer to onUserTurn, then closes everything. */
  disconnect: () => void;
  /** Inject a bracketed note the interviewer must follow (e.g. time warnings). */
  injectNote: (text: string, respond?: boolean) => void;
}

const HALLUCINATIONS = new Set([
  "thank you",
  "thank you.",
  "thanks for watching",
  "thanks for watching.",
  "thank you for watching",
  "thank you for watching.",
  "please subscribe",
  "subtitles by",
  "bye",
  "bye.",
  "you",
  "you.",
  "the end",
  "the end.",
  "so",
  "so.",
  "okay",
  "ok",
  "hmm",
  "mm",
  "mm-hmm",
  "uh",
  "um",
]);

const SHORT_ANSWERS = new Set([
  "yes",
  "no",
  "yeah",
  "yep",
  "nope",
  "sure",
  "correct",
  "right",
  "exactly",
  "done",
  "hello",
  "hi",
  "okay",
  "ok",
]);

export function isUsableTranscript(raw: string): boolean {
  const norm = raw.trim().toLowerCase().replace(/\s+/g, " ");
  if (!norm) return false;
  if (HALLUCINATIONS.has(norm)) return false;

  const chars = norm.replace(/\s/g, "");
  if (chars.length > 0) {
    let nonLatin = 0;
    for (const c of chars) {
      const code = c.codePointAt(0) ?? 0;
      if (code > 0x024f && !"‘’“”–—…".includes(c)) nonLatin++;
    }
    if (nonLatin / chars.length > 0.3) return false;
  }

  const words = norm.match(/[a-z0-9'’-]+/g) ?? [];
  if (words.length === 0) return false;
  if (words.length === 1) {
    // One-word technical answers ("Serializable.", "Postgres.") are real;
    // stray function words and very short fragments are noise.
    const w = words[0]!.replace(/\.$/, "");
    return SHORT_ANSWERS.has(w) || (w.length >= 3 && !FUNCTION_WORDS.has(w));
  }
  return true;
}

/** Words a candidate trails off on mid-thought ("…and the cache sits in front of, um"). */
const TRAILING_WORDS = new Set([
  "and", "but", "or", "so", "because", "cause", "since", "then", "if", "when",
  "while", "which", "that", "where", "like", "um", "uh", "er", "hmm", "the",
  "a", "an", "to", "of", "for", "with", "in", "on", "at", "from", "by", "is",
  "are", "was", "would", "could", "should", "will", "can", "i", "we", "my",
  "our", "basically", "also", "maybe", "probably",
]);

/**
 * True when the answer so far sounds cut off mid-thought: it ends on a
 * connective/filler word, trails off with "..." or a comma, or has no
 * sentence-ending punctuation. The transcriber punctuates complete sentences,
 * so a missing full stop is a useful "still thinking" signal.
 */
export function looksUnfinished(raw: string): boolean {
  const text = raw.trim();
  if (!text) return false;
  if (/(\.\.\.|…|,|-|—)$/.test(text)) return true;
  const words = text.toLowerCase().match(/[a-z0-9'’]+/g) ?? [];
  const last = words[words.length - 1];
  if (last && TRAILING_WORDS.has(last)) return true;
  // One/two-word replies ("Yes", "Consistent hashing") often lack a full stop.
  if (words.length <= 2) return false;
  return !/[.?!]["”')]*$/.test(text);
}

const FUNCTION_WORDS = new Set([
  "the", "and", "but", "for", "with", "that", "this", "was", "are", "not",
  "have", "has", "had", "from", "they", "them", "then", "than", "what", "when",
  "who", "how", "why", "our", "your", "his", "her", "she", "him", "its",
]);

interface GatedAudio {
  track: MediaStreamTrack;
  setSpeaking: (speaking: boolean) => void;
  dispose: () => void;
}

function buildGatedAudio(mic: MediaStream, tuning: RealtimeTuning): GatedAudio {
  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(mic);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  // Pre-roll: the analyser hears the mic live, but the audio sent on is
  // delayed, so the gate is already open when a word's first syllable reaches
  // it. Without this every phrase lost its onset and transcripts came back
  // garbled.
  const preroll = ctx.createDelay(1);
  preroll.delayTime.value = tuning.gatePrerollMs / 1000;
  const dest = ctx.createMediaStreamDestination();

  source.connect(analyser);
  source.connect(preroll);
  preroll.connect(gain);
  gain.connect(dest);

  const buf = new Float32Array(analyser.fftSize);
  // Start low and let it adapt: starting high (3 × 0.02) muted quiet speakers
  // until the floor had time to settle.
  let floor = 0.008;
  let open = false;
  let speaking = false;
  let lastAbove = 0;

  const timer = window.setInterval(() => {
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i]! * buf[i]!;
    const rms = Math.sqrt(sum / buf.length);

    // Track the room's noise floor only while the gate is closed, so a long
    // answer can't drag the floor up and choke itself off mid-sentence.
    if (!open) {
      floor = rms < floor ? rms : Math.min(0.08, floor * 0.995 + rms * 0.005);
    }

    let threshold = Math.max(tuning.gateMinRms, floor * tuning.gateFloorMultiplier);
    if (speaking) threshold *= tuning.gateSpeakingMultiplier;

    const now = performance.now();
    if (rms > threshold) {
      lastAbove = now;
      if (!open) {
        open = true;
        gain.gain.setTargetAtTime(1, ctx.currentTime, 0.01);
      }
    } else if (open && now - lastAbove > tuning.gateReleaseMs) {
      open = false;
      gain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    }
  }, 20);

  return {
    track: dest.stream.getAudioTracks()[0]!,
    setSpeaking: (s) => {
      speaking = s;
    },
    dispose: () => {
      window.clearInterval(timer);
      source.disconnect();
      preroll.disconnect();
      gain.disconnect();
      ctx.close().catch(() => {});
    },
  };
}

export interface ConnectOptions {
  clientSecret: string;
  micStream: MediaStream;
  audioEl: HTMLAudioElement;
  callbacks: RealtimeCallbacks;
  tuning?: Partial<RealtimeTuning>;
  /** Sent as the very first response so the interviewer opens the conversation. */
  openingInstruction?: string;
}

export async function connectRealtime(opts: ConnectOptions): Promise<RealtimeHandle> {
  const tuning = { ...DEFAULT_TUNING, ...opts.tuning };
  const cb = opts.callbacks;
  const gated = buildGatedAudio(opts.micStream, tuning);

  const pc = new RTCPeerConnection();
  pc.addTrack(gated.track, new MediaStream([gated.track]));
  pc.ontrack = (e) => {
    opts.audioEl.srcObject = e.streams[0] ?? null;
    opts.audioEl.play().catch(() => {});
  };

  const dc = pc.createDataChannel("oai-events");

  let disposed = false;
  let assistantSpeaking = false;
  let responseActive = false;
  let responseQueued = false;
  let pending: UserTurn | null = null;
  let graceTimer: number | null = null;
  let interviewerBuffer = "";
  // Transcripts arrive later than the VAD events that bracket them, and the
  // candidate may already be into the next segment — so timing is tracked
  // per item, never in a single "current segment" slot.
  const segmentTimes = new Map<string, { start: number; end?: number }>();

  const send = (event: Record<string, unknown>) => {
    if (dc.readyState === "open") dc.send(JSON.stringify(event));
  };

  const setStatus = (s: RealtimeStatus) => {
    if (!disposed) cb.onStatus(s);
  };

  // OpenAI rejects response.create while a response is in flight, so queue
  // the request and fire it when the current one completes.
  const requestResponse = () => {
    if (responseActive) {
      responseQueued = true;
      return;
    }
    responseActive = true;
    send({ type: "response.create" });
  };

  const clearGrace = () => {
    if (graceTimer !== null) {
      window.clearTimeout(graceTimer);
      graceTimer = null;
    }
  };

  const armGrace = () => {
    clearGrace();
    // Give a mid-thought pause more room before the interviewer jumps in.
    const wait =
      pending && looksUnfinished(pending.text)
        ? tuning.unfinishedGraceMs
        : tuning.responseGraceMs;
    graceTimer = window.setTimeout(flushPending, wait);
  };

  const flushPending = () => {
    graceTimer = null;
    if (!pending) return;
    const turn = pending;
    pending = null;
    cb.onUserTurn(turn);
    requestResponse();
  };

  const handleEvent = (ev: Record<string, unknown>) => {
    const type = ev.type as string;
    switch (type) {
      case "input_audio_buffer.speech_started": {
        segmentTimes.set(ev.item_id as string, { start: Date.now() });
        // Candidate is still going — hold the model's reply until this
        // segment's transcript lands.
        clearGrace();
        if (!assistantSpeaking) setStatus("listening");
        break;
      }
      case "input_audio_buffer.speech_stopped": {
        const now = Date.now();
        const seg = segmentTimes.get(ev.item_id as string);
        if (seg) seg.end = now;
        const duration = now - (seg?.start ?? now);
        if (assistantSpeaking && duration >= tuning.interruptMinMs) {
          // Audio keeps playing after generation finishes, so a response may
          // no longer be active; cancelling then just returns an error.
          if (responseActive) send({ type: "response.cancel" });
          send({ type: "output_audio_buffer.clear" });
        }
        break;
      }
      case "conversation.item.input_audio_transcription.completed": {
        const itemId = ev.item_id as string;
        const text = ((ev.transcript as string) ?? "").trim();
        const seg = segmentTimes.get(itemId);
        segmentTimes.delete(itemId);
        const endedAt = seg?.end ?? Date.now();
        const startedAt = seg?.start ?? endedAt;

        if (!isUsableTranscript(text)) {
          send({ type: "conversation.item.delete", item_id: itemId });
          if (pending) armGrace();
          break;
        }

        const segment: Segment = { start: startedAt, end: endedAt };
        if (pending) {
          pending.text = `${pending.text} ${text}`.trim();
          pending.startedAt = Math.min(pending.startedAt, startedAt);
          pending.endedAt = Math.max(pending.endedAt, endedAt);
          pending.segments.push(segment);
        } else {
          pending = { text, startedAt, endedAt, segments: [segment] };
        }
        armGrace();
        break;
      }
      case "conversation.item.input_audio_transcription.failed": {
        send({ type: "conversation.item.delete", item_id: ev.item_id as string });
        segmentTimes.delete(ev.item_id as string);
        if (pending) armGrace();
        break;
      }
      case "response.created": {
        responseActive = true;
        break;
      }
      case "response.done": {
        responseActive = false;
        if (responseQueued) {
          responseQueued = false;
          requestResponse();
        }
        break;
      }
      case "output_audio_buffer.started": {
        assistantSpeaking = true;
        gated.setSpeaking(true);
        setStatus("speaking");
        break;
      }
      case "output_audio_buffer.stopped":
      case "output_audio_buffer.cleared": {
        assistantSpeaking = false;
        gated.setSpeaking(false);
        setStatus("listening");
        break;
      }
      case "response.output_audio_transcript.delta":
      case "response.audio_transcript.delta": {
        const delta = (ev.delta as string) ?? "";
        interviewerBuffer += delta;
        cb.onInterviewerDelta?.(delta);
        break;
      }
      case "response.output_audio_transcript.done":
      case "response.audio_transcript.done": {
        const text = ((ev.transcript as string) ?? interviewerBuffer).trim();
        interviewerBuffer = "";
        if (text) cb.onInterviewerTurn(text);
        break;
      }
      case "error": {
        const err = ev.error as { message?: string; code?: string } | undefined;
        // Benign race: the reply finished just as the candidate barged in.
        if (err?.code === "response_cancel_not_active") break;
        cb.onError(err?.message ?? "Realtime session error");
        break;
      }
      default:
        break;
    }
  };

  dc.onmessage = (e) => {
    try {
      handleEvent(JSON.parse(e.data as string));
    } catch {
      // Non-JSON frames are not part of the protocol; ignore.
    }
  };

  const opened = new Promise<void>((resolve, reject) => {
    dc.onopen = () => resolve();
    dc.onerror = () => reject(new Error("Data channel failed to open"));
  });

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
      setStatus("disconnected");
    }
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const res = await fetch("https://api.openai.com/v1/realtime/calls", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.clientSecret}`,
      "Content-Type": "application/sdp",
    },
    body: offer.sdp,
  });
  if (!res.ok) {
    gated.dispose();
    pc.close();
    const body = await res.text().catch(() => "");
    let detail = body.slice(0, 300);
    try {
      const parsed = JSON.parse(body) as { error?: { message?: string; code?: string } };
      if (parsed.error?.message) {
        detail = parsed.error.code
          ? `${parsed.error.code}: ${parsed.error.message}`
          : parsed.error.message;
      }
    } catch {}
    throw new Error(`OpenAI refused the call (${res.status})${detail ? ` — ${detail}` : ""}`);
  }
  await pc.setRemoteDescription({ type: "answer", sdp: await res.text() });
  await opened;

  setStatus("listening");
  responseActive = true;
  send({
    type: "response.create",
    response: {
      instructions:
        opts.openingInstruction ??
        "Speak only in English. Greet the candidate and begin the interview with the warm-up question.",
    },
  });

  return {
    disconnect: () => {
      if (disposed) return;
      clearGrace();
      if (pending) {
        const turn = pending;
        pending = null;
        cb.onUserTurn(turn);
      }
      disposed = true;
      try {
        dc.close();
      } catch {}
      pc.close();
      gated.dispose();
      opts.audioEl.srcObject = null;
    },
    injectNote: (text, respond = true) => {
      send({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "system",
          content: [{ type: "input_text", text: `[${text}]` }],
        },
      });
      if (respond) requestResponse();
    },
  };
}
