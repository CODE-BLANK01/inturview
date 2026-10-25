/**
 * Delivery metrics for one spoken answer: pace, filler words and the longest
 * pause. Computed server-side when a voice turn is saved, and summarised for
 * the debrief by summarizeDeliveryMetrics (lib/faceToFacePrompts.ts).
 *
 * Mirrors turn_metrics in services/realtime/app/metrics.py. Keep in step.
 */

import type { TurnMetrics } from "./faceToFacePrompts";

// Multi-word fillers come first so "you know" isn't also counted as a word.
const FILLER_RE =
  /\byou know\b|\bsort of\b|\bkind of\b|\bi mean\b|\bum+\b|\buh+\b|\berm*\b|\bhmm+\b|\bbasically\b|\bliterally\b/gi;

const WORD_RE = /[A-Za-z0-9'’-]+/g;

export interface SpeechSegment {
  /** Epoch ms when the candidate started speaking. */
  start: number;
  /** Epoch ms when they stopped. */
  end: number;
}

export function turnMetrics(
  text: string,
  durationMs: number | null,
  segments: SpeechSegment[] | null
): TurnMetrics {
  const words = text.match(WORD_RE)?.length ?? 0;
  const fillers = text.match(FILLER_RE)?.length ?? 0;

  // The longest silence between two speech segments of the same answer.
  let longestPause = 0;
  if (segments && segments.length > 1) {
    const ordered = [...segments].sort((a, b) => a.start - b.start);
    for (let i = 1; i < ordered.length; i++) {
      longestPause = Math.max(longestPause, ordered[i]!.start - ordered[i - 1]!.end);
    }
  }

  const metrics: TurnMetrics = {
    words,
    filler_count: fillers,
    filler_per_100_words: words ? round1((fillers / words) * 100) : 0,
    longest_pause_ms: longestPause,
    segments: segments?.length || 1,
  };
  if (durationMs && durationMs > 0) {
    metrics.duration_ms = durationMs;
    metrics.wpm = round1(words / (durationMs / 60_000));
  }
  return metrics;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
