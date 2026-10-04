"use client";

/**
 * Interviewer face for the face-to-face round, via HeyGen LiveAvatar (LITE mode).
 *
 * The interview itself is unchanged: OpenAI Realtime still listens, decides
 * turns and produces the interviewer's voice (lib/realtimeClient.ts). With the
 * avatar on, that voice arrives as raw 24 kHz PCM16 deltas over the realtime
 * service's WebSocket relay, which is exactly LiveAvatar's input format; this
 * module regroups the deltas into whole-frame chunks and streams them as
 * `agent.speak`. The lip-synced face *and* voice come back through a LiveKit
 * room.
 *
 * Any failure ends the avatar (onEnded); the caller plays the voice itself and
 * the interview continues voice-only.
 */

import { Room, RoomEvent, Track, type RemoteTrack } from "livekit-client";
import { base64ToBytes, bytesToBase64 } from "./pcmAudio";

export interface AvatarSession {
  avatar_session_id: string;
  livekit_url: string;
  livekit_client_token: string;
  ws_url: string;
  max_session_duration: number | null;
}

export type AvatarState = "idle" | "listening" | "talking";

export interface AvatarCallbacks {
  onState: (state: AvatarState) => void;
  /** The avatar is gone for good (expired, failed, closed by LiveAvatar). */
  onEnded: (reason: string) => void;
}

export interface AvatarHandle {
  /** Show the face in this element (call again when the element changes). */
  attachVideo: (el: HTMLVideoElement | null) => void;
  /** One delta of the interviewer's voice: base64 PCM16, 24 kHz mono. */
  pushAudio: (pcm16Base64: string) => void;
  /** The current reply's audio is complete. */
  endAudio: () => void;
  /** Candidate barged in: drop whatever the face still has queued. */
  interrupt: () => void;
  close: () => void;
}

// LiveAvatar renders 25 fps video: one frame per 960 samples (1,920 bytes) at
// 24 kHz. Chunks are whole frames, and ~1 s long as LiveAvatar recommends.
const FRAME_BYTES = 960 * 2;
const CHUNK_BYTES = FRAME_BYTES * 25;
const KEEP_ALIVE_MS = 60_000; // LiveAvatar idles out after 5 minutes
const CONNECT_TIMEOUT_MS = 15_000;

export async function connectAvatar(
  session: AvatarSession,
  avatarAudioEl: HTMLAudioElement,
  cb: AvatarCallbacks
): Promise<AvatarHandle> {
  let ended = false;
  let keepAlive: number | null = null;
  let utteranceId: string | null = null;
  // The video can arrive before the live view mounts its <video>; keep both.
  let videoTrack: RemoteTrack | null = null;
  let videoEl: HTMLVideoElement | null = null;
  let avatarAudioTrack: RemoteTrack | null = null;
  // Voice bytes not yet sent (less than a whole chunk).
  let pending = new Uint8Array(0);

  const room = new Room();
  const ws = new WebSocket(session.ws_url);

  const send = (event: Record<string, unknown>) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(event));
  };

  const end = (reason: string) => {
    if (ended) return;
    ended = true;
    if (keepAlive !== null) window.clearInterval(keepAlive);
    try {
      ws.close();
    } catch {
      /* already closed */
    }
    room.disconnect().catch(() => {});
    avatarAudioEl.srcObject = null;
    cb.onEnded(reason);
  };

  room.on(RoomEvent.TrackSubscribed, (track) => {
    if (track.kind === Track.Kind.Video) {
      videoTrack = track;
      if (videoEl) track.attach(videoEl);
    }
    if (track.kind === Track.Kind.Audio && !avatarAudioTrack) {
      // Play exactly one voice track on its own stream; track.attach() would
      // mix any extra tracks into the same element.
      avatarAudioTrack = track;
      avatarAudioEl.srcObject = new MediaStream([track.mediaStreamTrack]);
      avatarAudioEl.play().catch(() => {});
    }
  });
  room.on(RoomEvent.Disconnected, () => end("The avatar's video connection closed."));

  // Commands are only accepted after session.state_updated → connected.
  const commandsReady = new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("Avatar took too long to connect")), CONNECT_TIMEOUT_MS);
    ws.onmessage = (e) => {
      let ev: {
        type?: string;
        state?: string;
        new_state?: AvatarState;
        error?: { message?: string };
        warning?: { type?: string; message?: string };
      };
      try {
        ev = JSON.parse(e.data as string);
      } catch {
        return;
      }
      if (ev.type === "session.state_updated" && ev.state === "connected") {
        window.clearTimeout(timer);
        resolve();
      } else if (ev.type === "session.state_updated" && ev.state === "disconnected") {
        end("The avatar session ended.");
      } else if (ev.type === "agent.state_updated" && ev.new_state) {
        cb.onState(ev.new_state);
      } else if (ev.type === "error" || ev.type === "warning") {
        console.warn(`[avatar] ${ev.type}:`, ev.warning ?? ev.error);
      }
    };
    ws.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error("Avatar command channel failed"));
    };
  });
  ws.onclose = () => end("The avatar session ended.");

  try {
    await Promise.all([room.connect(session.livekit_url, session.livekit_client_token), commandsReady]);
  } catch (err) {
    end(err instanceof Error ? err.message : "Avatar failed to connect");
    throw err;
  }

  keepAlive = window.setInterval(() => send({ type: "session.keep_alive" }), KEEP_ALIVE_MS);

  const speak = (bytes: Uint8Array) => {
    // The first chunk's event_id names the utterance.
    if (!utteranceId) utteranceId = crypto.randomUUID();
    send({ type: "agent.speak", event_id: utteranceId, audio: bytesToBase64(bytes) });
  };

  return {
    attachVideo: (el) => {
      if (el === videoEl) return;
      if (videoEl && videoTrack) videoTrack.detach(videoEl);
      videoEl = el;
      if (el && videoTrack) videoTrack.attach(el);
    },
    pushAudio: (b64) => {
      if (ended) return;
      const incoming = base64ToBytes(b64);
      const joined = new Uint8Array(pending.length + incoming.length);
      joined.set(pending);
      joined.set(incoming, pending.length);
      let offset = 0;
      while (joined.length - offset >= CHUNK_BYTES) {
        speak(joined.subarray(offset, offset + CHUNK_BYTES));
        offset += CHUNK_BYTES;
      }
      pending = joined.slice(offset);
    },
    endAudio: () => {
      if (ended) return;
      if (pending.length) {
        // Pad the tail with silence to a whole video frame.
        const padded = new Uint8Array(Math.ceil(pending.length / FRAME_BYTES) * FRAME_BYTES);
        padded.set(pending);
        speak(padded);
        pending = new Uint8Array(0);
      }
      if (utteranceId) send({ type: "agent.speak_end" });
      utteranceId = null;
    },
    interrupt: () => {
      send({ type: "agent.interrupt" });
      utteranceId = null;
      pending = new Uint8Array(0);
    },
    close: () => end("closed"),
  };
}
