/** Pure loop maths, safe to import in the browser (no database, no env). */

export interface EstimatableRound {
  id: string;
  durationMinutes: number;
}

/** What one minute of a round costs. Rounds are a text chat with the AI interviewer. */
export interface LiveRates {
  chat: number;
}

export const SCORING_PER_ROUND_USD = 0.05;

export const totalMinutes = (rounds: EstimatableRound[]) => rounds.reduce((n, r) => n + r.durationMinutes, 0);

/**
 * Rough cost of one candidate finishing the loop: the AI interviewer's text
 * chat for every minute, plus scoring each round. For planning, not billing.
 */
export function estimateLoopCost(rounds: EstimatableRound[], rates: LiveRates, scoringPerRoundUsd = SCORING_PER_ROUND_USD) {
  const perRound = rounds.map((r) => ({
    id: r.id,
    usd: Math.round((r.durationMinutes * rates.chat + scoringPerRoundUsd) * 100) / 100,
  }));
  return { perRound, totalUsd: Math.round(perRound.reduce((n, r) => n + r.usd, 0) * 100) / 100 };
}
