/**
 * The voice plan stored on a spoken ConversationSession (`plan` column) for
 * the recruiter screen and behavioral rounds. Its presence is what marks a
 * session as spoken rather than typed.
 *
 * The clock runs from `voiceStartedAt`, not the session's startedAt: a typed
 * session continued by voice gets its full voice time, while reconnecting to
 * a voice session keeps the original clock.
 */

export type VoiceKind = "BEHAVIORAL" | "RECRUITER_SCREEN";

export interface VoicePlan {
  voice: true;
  maxDurationSec: number;
  /** ISO timestamp of the first voice connect. */
  voiceStartedAt: string;
  /**
   * The voice interviewer's end-of-call notes on what the candidate said,
   * from the actual audio (see requestNotes in lib/realtimeClient.ts).
   */
  interviewerNotes?: string;
}

/** Turns may land shortly after the cap while the interviewer wraps up. */
export const LATE_TURN_GRACE_MS = 2 * 60 * 1000;

/** Default call length per round: the recruiter screen is a 25-minute call. */
const DEFAULT_MINUTES: Record<VoiceKind, number> = { RECRUITER_SCREEN: 25, BEHAVIORAL: 15 };

export function voiceMaxSec(kind: VoiceKind): number {
  const raw =
    kind === "RECRUITER_SCREEN"
      ? process.env.RECRUITER_VOICE_MAX_MINUTES
      : process.env.BEHAVIORAL_VOICE_MAX_MINUTES;
  const minutes = Number(raw);
  return Math.round((Number.isFinite(minutes) && minutes > 0 ? minutes : DEFAULT_MINUTES[kind]) * 60);
}

export function newVoicePlan(kind: VoiceKind, now = new Date()): VoicePlan {
  return { voice: true, maxDurationSec: voiceMaxSec(kind), voiceStartedAt: now.toISOString() };
}

/** Returns the voice plan, or null for a typed session. */
export function readVoicePlan(plan: unknown): VoicePlan | null {
  if (!plan || typeof plan !== "object") return null;
  const p = plan as Partial<VoicePlan>;
  if (p.voice !== true || typeof p.maxDurationSec !== "number" || typeof p.voiceStartedAt !== "string") {
    return null;
  }
  // Malformed notes are dropped; they never make a voice session read as typed.
  const { interviewerNotes, ...rest } = p as VoicePlan;
  return typeof interviewerNotes === "string" ? { ...rest, interviewerNotes } : rest;
}

/** Epoch ms when the voice time runs out. */
export function voiceDeadlineMs(plan: VoicePlan): number {
  return new Date(plan.voiceStartedAt).getTime() + plan.maxDurationSec * 1000;
}

/** Minutes of live voice used so far, capped at the plan limit (for cost tracking). */
export function voiceMinutesUsed(plan: VoicePlan, now = Date.now()): number {
  const start = new Date(plan.voiceStartedAt).getTime();
  const cap = plan.maxDurationSec * 1000 + LATE_TURN_GRACE_MS;
  return Math.max(0, Math.min(now - start, cap)) / 60_000;
}
