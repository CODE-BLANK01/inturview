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
