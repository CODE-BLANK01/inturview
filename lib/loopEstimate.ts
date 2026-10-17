/** Pure loop maths, safe to import in the browser (no database, no env). */

export interface EstimatableRound {
  id: string;
  durationMinutes: number;
}

export interface LiveRates {
  voice: number;
  avatar: number;
}

export const SCORING_PER_ROUND_USD = 0.05;

export const totalMinutes = (rounds: EstimatableRound[]) => rounds.reduce((n, r) => n + r.durationMinutes, 0);

/**
 * Rough cost of one candidate finishing the loop: live voice and avatar for
 * every minute, plus scoring each round. For planning, not billing.
 */
export function estimateLoopCost(rounds: EstimatableRound[], rates: LiveRates, scoringPerRoundUsd = SCORING_PER_ROUND_USD) {
  const perRound = rounds.map((r) => ({
    id: r.id,
    usd: Math.round((r.durationMinutes * (rates.voice + rates.avatar) + scoringPerRoundUsd) * 100) / 100,
  }));
  return { perRound, totalUsd: Math.round(perRound.reduce((n, r) => n + r.usd, 0) * 100) / 100 };
}
