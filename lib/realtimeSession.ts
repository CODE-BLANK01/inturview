/**
 * Server-side OpenAI Realtime session minting for the spoken practice rounds
 * (recruiter screen, behavioral).
 *
 * The browser never sees OPENAI_API_KEY. A route mints a short-lived client
 * secret with the whole session config (instructions, voice, turn detection)
 * baked in, and the browser uses it to open a WebRTC call straight to OpenAI
 * (see lib/realtimeClient.ts). No realtime service is involved.
 *
 * The config follows build_session_config in services/realtime/app/realtime.py
 * (face-to-face), except for turn detection, which is tuned for conversation.
 */

const CLIENT_SECRETS_URL = "https://api.openai.com/v1/realtime/client_secrets";

/** Ephemeral key lifetime. It only has to cover the WebRTC connect. */
const CLIENT_SECRET_TTL_SEC = 600;

export const OUTPUT_LANGUAGE_RULE =
  "LANGUAGE RULE: Speak only in English. Every spoken response must be in English, " +
  "regardless of the candidate's language, browser locale, accent, transcript text, " +
  "or any earlier turn. Never switch languages or translate the interview.\n\n";

export function realtimeModel(): string {
  return process.env.OPENAI_REALTIME_MODEL || "gpt-realtime";
}

/**
 * Session config baked into the client secret. The choices:
 * - noise_reduction runs before turn detection, so breathing and keyboard
 *   clicks are damped before the detector hears them.
 * - semantic_vad ends a segment when the candidate sounds finished, so each
 *   transcript is a whole utterance. Medium eagerness caps the wait at ~4 s;
 *   low (face-to-face) could sit ~8 s, which felt like a frozen interviewer.
 *   server_vad with a short silence was tried and chopped speech into short
 *   clips that transcribed badly. The browser still decides when the answer
 *   is over (see CONVERSATION_TUNING in lib/useVoiceInterview.ts).
 * - create_response / interrupt_response are off: the browser decides when the
 *   interviewer replies (after a transcript passes the junk filter) and when a
 *   barge-in is real.
 * - The transcription language is pinned so noise isn't "translated". There
 *   is deliberately no transcription prompt: on short or unclear audio the
 *   transcriber read the prompt back as if the candidate had said it.
 */
export function buildRealtimeSessionConfig(opts: { instructions: string }) {
  return {
    type: "realtime",
    model: realtimeModel(),
    instructions: `${OUTPUT_LANGUAGE_RULE}${opts.instructions}`,
    output_modalities: ["audio"],
    audio: {
      input: {
        noise_reduction: { type: "near_field" },
        // Captions and the debrief transcript only; the interviewer hears the
        // audio itself. Swappable to compare accuracy on accented speech.
        transcription: {
          model: process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-transcribe",
          language: "en",
        },
        turn_detection: {
          type: "semantic_vad",
          eagerness: "medium",
          create_response: false,
          interrupt_response: false,
        },
      },
      output: { voice: process.env.OPENAI_REALTIME_VOICE || "marin" },
    },
    max_output_tokens: 700,
  };
}

export class RealtimeMintError extends Error {}

/** Mints an ephemeral client secret the browser can open one call with. */
export async function mintRealtimeClientSecret(opts: { instructions: string }): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new RealtimeMintError("Voice interviews are not configured (OPENAI_API_KEY).");

  const res = await fetch(CLIENT_SECRETS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      expires_after: { anchor: "created_at", seconds: CLIENT_SECRET_TTL_SEC },
      session: buildRealtimeSessionConfig(opts),
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    // OpenAI's error body never contains our key, but keep it short for logs.
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    console.error("[realtime] client secret mint failed", res.status, detail);
    throw new RealtimeMintError("Couldn't start the voice interviewer. Try again in a moment.");
  }
  const data = (await res.json()) as { value?: string };
  if (!data.value) throw new RealtimeMintError("OpenAI returned no client secret.");
  return data.value;
}
