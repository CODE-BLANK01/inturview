import { prisma } from "./db";
import { PROBLEMS, TOPICS } from "./problems";
import type { Problem } from "./types";

export interface DashboardData {
  stats: {
    interviewsCompleted: number;
    uniqueProblemsAttempted: number;
    averageScore: number | null;
    bestScore: number | null;
    daysActive: number;
    strongestTopic: { name: string; avg: number } | null;
  };
  inProgress: {
    id: string;
    problemId: string;
    startedAt: Date;
    problem: { title: string; difficulty: string; topic: string };
  } | null;
  recent: Array<{
    id: string;
    problemId: string;
    totalScore: number | null;
    recommendation: string | null;
    completedAt: Date | null;
    problem: { title: string; difficulty: string; topic: string };
  }>;
  topicMastery: Array<{
    topic: string;
    attempted: number;
    total: number;
    avgScore: number | null;
  }>;
  /** A problem to surface as "Try this next" when there's nothing in progress
   *  and at least one completed interview exists. Null on first session. */
  suggestion: {
    problemId: string;
    title: string;
    difficulty: string;
    topic: string;
    reason: string;
  } | null;
}

const DIFFICULTY_ORDER = { Easy: 0, Medium: 1, Hard: 2 } as const;

export async function loadDashboardData(userId: string): Promise<DashboardData> {
  const [completed, inProgress] = await Promise.all([
    prisma.interview.findMany({
      where: { userId, status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
      select: {
        id: true,
        problemId: true,
        totalScore: true,
        recommendation: true,
        completedAt: true,
        problem: { select: { title: true, difficulty: true, topic: true } },
      },
    }),
    prisma.interview.findFirst({
      where: { userId, status: "IN_PROGRESS" },
      orderBy: { startedAt: "desc" },
      select: {
        id: true,
        problemId: true,
        startedAt: true,
        problem: { select: { title: true, difficulty: true, topic: true } },
      },
    }),
  ]);

  // Stats
  const interviewsCompleted = completed.length;
  const uniqueProblemsAttempted = new Set(completed.map((c) => c.problemId)).size;
  const scores = completed.map((c) => c.totalScore).filter((s): s is number => s !== null);
  const averageScore = scores.length
    ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
    : null;
  const bestScore = scores.length ? Math.max(...scores) : null;
  const daysActive = new Set(
    completed
      .map((c) => c.completedAt?.toISOString().slice(0, 10))
      .filter((d): d is string => Boolean(d))
  ).size;

  // Topic stats
  const topicAcc: Record<string, { count: number; sum: number; uniqueProblems: Set<string> }> = {};
  for (const iv of completed) {
    const t = iv.problem.topic;
    if (!topicAcc[t]) topicAcc[t] = { count: 0, sum: 0, uniqueProblems: new Set() };
    topicAcc[t].count += 1;
    if (iv.totalScore !== null) topicAcc[t].sum += iv.totalScore;
    topicAcc[t].uniqueProblems.add(iv.problemId);
  }
  let strongestTopic: DashboardData["stats"]["strongestTopic"] = null;
  for (const [name, agg] of Object.entries(topicAcc)) {
    if (agg.count < 1) continue;
    const avg = agg.sum / agg.count;
    if (!strongestTopic || avg > strongestTopic.avg) {
      strongestTopic = { name, avg: Math.round(avg * 10) / 10 };
    }
  }

  const topicTotals: Record<string, number> = {};
  for (const p of PROBLEMS) topicTotals[p.topic] = (topicTotals[p.topic] ?? 0) + 1;

  const topicMastery: DashboardData["topicMastery"] = TOPICS.filter(
    (t) => (topicTotals[t] ?? 0) > 0
  ).map((topic) => {
    const agg = topicAcc[topic];
    return {
      topic,
      attempted: agg?.uniqueProblems.size ?? 0,
      total: topicTotals[topic] ?? 0,
      avgScore: agg && agg.count > 0 ? Math.round((agg.sum / agg.count) * 10) / 10 : null,
    };
  });

  // Next-up suggestion. Only surfaced when there's nothing in progress AND the
  // user has at least one completion (otherwise the "Run your first interview"
  // copy in ResumeRow does the job).
  const attemptedIds = new Set(completed.map((c) => c.problemId));
  const suggestion = !inProgress && completed.length > 0
    ? suggestNextProblem({
        completed: completed.map((c) => ({
          problemId: c.problemId,
          topic: c.problem.topic,
          difficulty: c.problem.difficulty,
        })),
        attemptedIds,
        strongestTopic,
      })
    : null;

  return {
    stats: {
      interviewsCompleted,
      uniqueProblemsAttempted,
      averageScore,
      bestScore,
      daysActive,
      strongestTopic,
    },
    inProgress,
    recent: completed.slice(0, 5),
    topicMastery,
    suggestion,
  };
}

/**
 * Picks one unattempted problem to suggest. Strategy:
 *   1. Same topic as the most recent completion, one difficulty rung up if
 *      available (you just nailed Easy in Arrays → try a Medium in Arrays).
 *   2. Same topic, any unattempted difficulty.
 *   3. Any unattempted problem in the user's strongest topic.
 *   4. Any unattempted Easy problem (fallback).
 *
 * Returns null only if the user has completed every seeded problem.
 */
function suggestNextProblem(opts: {
  completed: { problemId: string; topic: string; difficulty: string }[];
  attemptedIds: Set<string>;
  strongestTopic: DashboardData["stats"]["strongestTopic"];
}): DashboardData["suggestion"] {
  const { completed, attemptedIds, strongestTopic } = opts;
  const unattempted = PROBLEMS.filter((p) => !attemptedIds.has(p.id));
  if (unattempted.length === 0) return null;

  const last = completed[0];
  if (last) {
    const lastDifficultyIdx =
      DIFFICULTY_ORDER[last.difficulty as keyof typeof DIFFICULTY_ORDER] ?? 0;
    const nextDifficultyIdx = Math.min(lastDifficultyIdx + 1, 2);
    const nextDifficulty = (Object.keys(DIFFICULTY_ORDER) as (keyof typeof DIFFICULTY_ORDER)[])
      .find((k) => DIFFICULTY_ORDER[k] === nextDifficultyIdx);

    // Strategy 1: same topic, next difficulty up
    const sameTopicLevelUp = unattempted.find(
      (p) => p.topic === last.topic && p.difficulty === nextDifficulty
    );
    if (sameTopicLevelUp) {
      return toSuggestion(
        sameTopicLevelUp,
        nextDifficulty === last.difficulty
          ? `More from ${last.topic}.`
          : `One step up from your last ${last.topic} problem.`
      );
    }

    // Strategy 2: same topic, any unattempted difficulty
    const sameTopicAny = unattempted.find((p) => p.topic === last.topic);
    if (sameTopicAny) {
      return toSuggestion(sameTopicAny, `Keep going in ${last.topic}.`);
    }
  }

  // Strategy 3: strongest topic, unattempted
  if (strongestTopic) {
    const inStrongest = unattempted.find((p) => p.topic === strongestTopic.name);
    if (inStrongest) {
      return toSuggestion(
        inStrongest,
        `You're strongest in ${strongestTopic.name} (${strongestTopic.avg}/25 avg) — try one more.`
      );
    }
  }

  // Strategy 4: any Easy fallback, then anything
  const anyEasy = unattempted.find((p) => p.difficulty === "Easy");
  const pick = anyEasy ?? unattempted[0];
  return toSuggestion(pick!, "Pick up something fresh.");
}

function toSuggestion(p: Problem, reason: string): DashboardData["suggestion"] {
  return {
    problemId: p.id,
    title: p.title,
    difficulty: p.difficulty,
    topic: p.topic,
    reason,
  };
}
