"use client";

import type { Phase } from "./types";

export type DesignPhase = "scope" | "design" | "debrief";

export interface DesignStreamRequest {
  session_id: string;
  problem_id: string;
  phase: DesignPhase;
  user_turn: string | null;
}

export interface StreamRequest {
  interview_id: string;
  problem_id: string;
  phase: Phase;
  /** The user's new turn for this phase, or null when the client just wants
   *  the AI to open the conversation (approach phase kickoff). */
  user_turn: string | null;
  /** Latest code editor contents — only meaningful for phase === "code". */
  user_code?: string;
}

export interface StreamCallbacks {
  onDelta: (chunk: string) => void;
  onDone: () => void;
  onError: (message: string) => void;
  /** Fires once per stream when the server emits a structured signal
   *  (e.g. approach-phase readiness, scope-phase acceptance). */
  onMeta?: (meta: { ready?: boolean; scoped?: boolean }) => void;
  signal?: AbortSignal;
}

export async function streamDesignMessage(
  body: DesignStreamRequest,
  cb: StreamCallbacks
): Promise<void> {
  return streamFromEndpoint("/api/design/message", body, cb);
}

export async function streamInterviewMessage(
  body: StreamRequest,
  cb: StreamCallbacks
): Promise<void> {
  return streamFromEndpoint("/api/interview/message", body, cb);
}

async function streamFromEndpoint(
  url: string,
  body: unknown,
  cb: StreamCallbacks
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: cb.signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") return;
    cb.onError(err instanceof Error ? err.message : "Network error");
    return;
  }

  if (!res.ok || !res.body) {
    let msg = `Request failed (${res.status})`;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {
      /* not json */
    }
    cb.onError(msg);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sep: number;
      while ((sep = buffer.indexOf("\n\n")) !== -1) {
        const raw = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        const lines = raw.split("\n");
        let event = "message";
        let data = "";
        for (const line of lines) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:")) data += line.slice(5).trim();
        }
        if (!data) continue;
        if (event === "delta") {
          try {
            const parsed = JSON.parse(data) as { text?: string };
            if (parsed.text) cb.onDelta(parsed.text);
          } catch {
            /* ignore malformed chunk */
          }
        } else if (event === "meta") {
          try {
            const parsed = JSON.parse(data) as { ready?: boolean; scoped?: boolean };
            cb.onMeta?.(parsed);
          } catch {
            /* ignore malformed meta */
          }
        } else if (event === "done") {
          cb.onDone();
          return;
        } else if (event === "error") {
          try {
            const parsed = JSON.parse(data) as { message?: string };
            cb.onError(parsed.message || "Stream error");
          } catch {
            cb.onError("Stream error");
          }
          return;
        }
      }
    }
    cb.onDone();
  } catch (err) {
    if ((err as Error).name !== "AbortError") {
      cb.onError(err instanceof Error ? err.message : "Stream read error");
    }
  }
}
