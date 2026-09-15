import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Copy .env.local.example to .env.local and add your key."
    );
  }
  client = new Anthropic({ apiKey, maxRetries: 2 });
  return client;
}

export const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";
// System-design interviews use a separate model knob — the surface is bigger
// (whiteboard context, multi-component trade-offs) so we may want a stronger
// model here independently from the coding loop.
export const DESIGN_MODEL =
  process.env.ANTHROPIC_DESIGN_MODEL || process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";

type StreamParams = Parameters<Anthropic["beta"]["promptCaching"]["messages"]["stream"]>[0];
type Turn = { role: "user" | "assistant"; content: string };

/**
 * Explicit 5-minute cache breakpoints on the system prompt and the last stable
 * transcript turn. Live editor/canvas context is appended after both markers.
 * The installed SDK exposes cache_control through its promptCaching beta client.
 */
export function cachedInterviewPrompt(
  system: string,
  turns: Turn[],
  liveContext?: string
): Pick<StreamParams, "system" | "messages"> {
  const messages: StreamParams["messages"] = turns.map((turn, index) => ({
    role: turn.role,
    content: [{
      type: "text",
      text: turn.content,
      ...(index === turns.length - 1 ? { cache_control: { type: "ephemeral" as const } } : {}),
    }],
  }));

  if (liveContext) {
    messages.push({
      role: "user",
      content: `LIVE INTERVIEW CONTEXT (not a new candidate answer; respond to the candidate's latest question):\n${liveContext}`,
    });
  }

  return {
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages,
  };
}

/** Opt-in operational check: zero/zero means this call did not create or read a cache. */
export function logCacheUsage(mode: string, usage: {
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}): void {
  if (process.env.ANTHROPIC_LOG_CACHE_USAGE !== "1") return;
  console.info("[anthropic/cache]", mode, {
    created: usage.cache_creation_input_tokens ?? 0,
    read: usage.cache_read_input_tokens ?? 0,
  });
}
