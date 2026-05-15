import { prisma } from "./db";
import { PROBLEMS, TOPICS } from "./problems";

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
}

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
  };
}
