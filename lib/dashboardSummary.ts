export interface CompletedRound {
  id: string;
  href: string;
  title: string;
  mode: string;
  totalScore: number | null;
  completedAt: Date | null;
}

/** All interview rubrics use the same 25-point scale. Dates are bucketed in UTC. */
export function summarizeRounds(rounds: CompletedRound[], now = new Date()) {
  const scores = rounds.flatMap((round) =>
    round.totalScore === null ? [] : [round.totalScore],
  );
  const dateCounts = new Map<string, number>();
  for (const round of rounds) {
    if (!round.completedAt) continue;
    const day = round.completedAt.toISOString().slice(0, 10);
    dateCounts.set(day, (dateCounts.get(day) ?? 0) + 1);
  }
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  return {
    interviewsCompleted: rounds.length,
    averageScore: scores.length
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) /
        10
      : null,
    bestScore: scores.length ? Math.max(...scores) : null,
    daysActive: dateCounts.size,
    recent: [...rounds]
      .sort(
        (a, b) =>
          (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0),
      )
      .slice(0, 5),
    activity: Array.from({ length: 7 }, (_, i) => {
      const date = new Date(today - (6 - i) * 86_400_000)
        .toISOString()
        .slice(0, 10);
      return { date, count: dateCounts.get(date) ?? 0 };
    }),
  };
}
