import { captureProductEvent, type Category } from "./analytics";

/**
 * $ per million tokens, from platform.claude.com/docs/en/about-claude/pricing
 * (checked 2026-10-10). Add a row when the app switches models; unknown models
 * are reported with cost 0 and priced: false so the gap is visible in PostHog.
 */
const CLAUDE_PRICES: { prefix: string; input: number; cacheWrite5m: number; cacheRead: number; output: number }[] = [
  { prefix: "claude-sonnet-4-5", input: 3, cacheWrite5m: 3.75, cacheRead: 0.3, output: 15 },
  { prefix: "claude-sonnet-4-6", input: 3, cacheWrite5m: 3.75, cacheRead: 0.3, output: 15 },
];

/** Usage as returned on message_start / message_delta / a non-streamed response. */
export interface ClaudeUsage {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

export function claudeCostUsd(model: string, usage: ClaudeUsage): { costUsd: number; priced: boolean } {
  const price = CLAUDE_PRICES.find((p) => model.startsWith(p.prefix));
  if (!price) return { costUsd: 0, priced: false };
  const perToken = (perMillion: number) => perMillion / 1_000_000;
  const costUsd =
    (usage.input_tokens ?? 0) * perToken(price.input) +
    (usage.cache_creation_input_tokens ?? 0) * perToken(price.cacheWrite5m) +
    (usage.cache_read_input_tokens ?? 0) * perToken(price.cacheRead) +
    (usage.output_tokens ?? 0) * perToken(price.output);
  return { costUsd: Math.round(costUsd * 1e6) / 1e6, priced: true };
}

/** One Claude call: an interviewer turn or a debrief. Never throws. */
export async function trackClaudeUsage(
  userId: string,
  opts: { category: Category; sessionId: string; model: string; purpose: "interview_turn" | "debrief"; usage: ClaudeUsage },
): Promise<void> {
  const { costUsd, priced } = claudeCostUsd(opts.model, opts.usage);
  await captureProductEvent(userId, {
    event: "ai_usage",
    properties: {
      category: opts.category,
      session_id: opts.sessionId,
      provider: "anthropic",
      model: opts.model,
      purpose: opts.purpose,
      input_tokens: opts.usage.input_tokens ?? 0,
      output_tokens: opts.usage.output_tokens ?? 0,
      cache_write_tokens: opts.usage.cache_creation_input_tokens ?? 0,
      cache_read_tokens: opts.usage.cache_read_input_tokens ?? 0,
      cost_usd: costUsd,
      estimated: !priced,
    },
  });
}

function ratePerMinute(value: string | undefined, fallback: number) {
  const v = Number(value);
  return value !== undefined && value !== "" && Number.isFinite(v) && v >= 0 ? v : fallback;
}

/**
 * Live voice and avatar time for a face-to-face round, billed per minute.
 * Rates are estimates until we read real invoices: OpenAI Realtime ≈ $1–2 per
 * 20 minutes (FACE_TO_FACE.md), HeyGen LiveAvatar LITE ≈ $0.10/min.
 */
export async function trackLiveMinutes(
  userId: string,
  opts: { sessionId: string; minutes: number; avatar: boolean },
): Promise<void> {
  const minutes = Math.max(0, Math.round(opts.minutes * 100) / 100);
  if (!minutes) return;
  const voiceRate = ratePerMinute(process.env.COST_REALTIME_VOICE_PER_MIN, 0.075);
  const avatarRate = ratePerMinute(process.env.COST_AVATAR_PER_MIN, 0.1);
  const base = { category: "face_to_face" as const, session_id: opts.sessionId, minutes, estimated: true };
  await captureProductEvent(userId, {
    event: "ai_usage",
    properties: { ...base, provider: "openai_realtime", model: "realtime", purpose: "live_voice", cost_usd: round(minutes * voiceRate) },
  });
  if (opts.avatar) {
    await captureProductEvent(userId, {
      event: "ai_usage",
      properties: { ...base, provider: "heygen", model: "liveavatar", purpose: "avatar", cost_usd: round(minutes * avatarRate) },
    });
  }
}

function round(usd: number) {
  return Math.round(usd * 1e6) / 1e6;
}
