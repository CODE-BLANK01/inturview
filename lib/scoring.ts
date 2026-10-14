// Scoring finished rounds. Finishing a round queues a "score_round" job and
// tries it right away; failures retry in the background (lib/jobs.ts). Every
// attempt is recorded in ScoringAttempt; the latest SUCCEEDED one is current.
import { InviteStatus, LoopRunStatus, Prisma, RoundRunStatus, ScoringStatus } from "@prisma/client";
import { prisma } from "./db";
import { getAnthropic, MODEL } from "./anthropic";
import { trackClaudeUsage, type ClaudeUsage } from "./aiCost";
import { enqueueJob, processJobs, type JobHandler } from "./jobs";
import { applicantDistinctId, CATEGORY_TO_ANALYTICS } from "./loopRuns";
import { publishedRounds } from "./loopTemplates";
import { overallScore, scoringPrompt, unansweredScorecard, validateGrade, type FrozenQuestion, type Scorecard } from "./loopRunEngine";

export const SCORE_JOB = "score_round";
const jobKey = (roundRunId: string) => `score:${roundRunId}`;

/** Calls the model. Swappable so tests don't hit the network. */
export type Grader = (prompt: { system: string; user: string }) => Promise<{ text: string; model: string; usage?: ClaudeUsage }>;

const anthropicGrader: Grader = async ({ system, user }) => {
  const resp = await getAnthropic().messages.create({ model: MODEL, max_tokens: 2000, system, messages: [{ role: "user", content: user }] });
  return { text: resp.content.map((b) => (b.type === "text" ? b.text : "")).join(""), model: MODEL, usage: resp.usage as ClaudeUsage };
};

class GradeFailed extends Error {}

/** One grading attempt. Throws when it should be retried. */
async function scoreOnce(roundRunId: string, grade: Grader) {
  const rr = await prisma.loopRoundRun.findUnique({
    where: { id: roundRunId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      run: { select: { inviteId: true, invite: { select: { campaign: { select: { organizationId: true } } } } } },
    },
  });
  // Nothing to do: the round was re-opened, deleted, or already scored by another worker.
  if (!rr || rr.status !== RoundRunStatus.SCORING) return;
  const questions = rr.questions as unknown as FrozenQuestion[];
  const ids = questions.map((q) => q.questionId);
  const attempt = (await prisma.scoringAttempt.count({ where: { roundRunId } })) + 1;
  const candidateSpoke = rr.messages.some((m) => m.role === "candidate" && m.content.trim().length > 0);

  let scorecard: Scorecard;
  let model = "none";
  if (!candidateSpoke) {
    scorecard = unansweredScorecard(ids);
  } else {
    let reply;
    try {
      reply = await grade(scoringPrompt(questions, rr.messages));
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      await prisma.scoringAttempt.create({ data: { roundRunId, attempt, status: ScoringStatus.ERROR, model: MODEL, error } });
      throw new GradeFailed(`Grader call failed: ${error}`);
    }
    model = reply.model;
    if (reply.usage) {
      await trackClaudeUsage(applicantDistinctId(rr.run.inviteId), {
        category: CATEGORY_TO_ANALYTICS[rr.category],
        sessionId: rr.id,
        model: reply.model,
        purpose: "debrief",
        usage: reply.usage,
        organizationId: rr.run.invite.campaign.organizationId,
      });
    }
    const result = validateGrade(reply.text, ids);
    if (!result.ok) {
      await prisma.scoringAttempt.create({ data: { roundRunId, attempt, status: ScoringStatus.INVALID, model, error: result.problems.join(" ") } });
      throw new GradeFailed(`Grader reply invalid: ${result.problems.join(" ")}`);
    }
    scorecard = result.scorecard;
  }

  const json = scorecard as unknown as Prisma.InputJsonValue;
  await prisma.$transaction([
    prisma.scoringAttempt.create({
      data: { roundRunId, attempt, status: ScoringStatus.SUCCEEDED, model, scorecard: json, score: scorecard.score, assessed: scorecard.assessed, total: scorecard.total },
    }),
    // Conditional: a concurrent re-open or score can't be overwritten.
    prisma.loopRoundRun.updateMany({
      where: { id: roundRunId, status: RoundRunStatus.SCORING },
      data: { status: RoundRunStatus.COMPLETED, scorecard: json, score: scorecard.score },
    }),
  ]);
  await refreshRun(rr.runId);
}

/** After the last automatic attempt fails: keep an earlier valid scorecard if there is one. */
async function giveUp(roundRunId: string) {
  const previous = await prisma.scoringAttempt.findFirst({
    where: { roundRunId, status: ScoringStatus.SUCCEEDED },
    orderBy: { attempt: "desc" },
  });
  await prisma.loopRoundRun.updateMany({
    where: { id: roundRunId, status: RoundRunStatus.SCORING },
    data: previous
      ? { status: RoundRunStatus.COMPLETED, scorecard: previous.scorecard ?? Prisma.JsonNull, score: previous.score }
      : { status: RoundRunStatus.SCORING_FAILED },
  });
}

export function scoringHandlers(grade: Grader = anthropicGrader): Record<string, JobHandler> {
  return {
    [SCORE_JOB]: {
      run: async (payload) => scoreOnce((payload as { roundRunId: string }).roundRunId, grade),
      onGiveUp: async (payload) => giveUp((payload as { roundRunId: string }).roundRunId),
    },
  };
}

/** Queues scoring for a round in SCORING and tries it now. */
async function queueAndTry(roundRunId: string, grade?: Grader) {
  await enqueueJob(SCORE_JOB, jobKey(roundRunId), { roundRunId });
  await processJobs(scoringHandlers(grade), { key: jobKey(roundRunId), limit: 1 });
  return prisma.loopRoundRun.findUniqueOrThrow({ where: { id: roundRunId } });
}

/** The candidate finished a round. Safe to call twice: only one call moves it to SCORING. */
export async function finishRound(roundRunId: string, grade?: Grader) {
  const claimed = await prisma.loopRoundRun.updateMany({
    where: { id: roundRunId, status: RoundRunStatus.IN_PROGRESS },
    data: { status: RoundRunStatus.SCORING, completedAt: new Date() },
  });
  if (claimed.count === 0) return prisma.loopRoundRun.findUniqueOrThrow({ where: { id: roundRunId } });
  return queueAndTry(roundRunId, grade);
}

/**
 * A person asked for a fresh score. The round goes back to SCORING; if every
 * attempt fails, the previous valid scorecard comes back (see giveUp).
 */
export async function rescoreRound(roundRunId: string, grade?: Grader) {
  await prisma.loopRoundRun.updateMany({
    where: { id: roundRunId, status: { in: [RoundRunStatus.COMPLETED, RoundRunStatus.SCORING_FAILED] } },
    data: { status: RoundRunStatus.SCORING },
  });
  return queueAndTry(roundRunId, grade);
}

/** Recomputes the run's overall score; completes the run once every round is scored. */
async function refreshRun(runId: string) {
  const run = await prisma.loopRun.findUniqueOrThrow({ where: { id: runId }, include: { rounds: true } });
  const version = await prisma.loopTemplateVersion.findUnique({
    where: { loopTemplateId_version: { loopTemplateId: run.loopTemplateId, version: run.loopVersion } },
    select: { snapshot: true },
  });
  const plan = publishedRounds(version?.snapshot);
  if (run.rounds.length < plan.length || run.rounds.some((r) => r.status !== RoundRunStatus.COMPLETED)) return;
  const overall = overallScore(
    run.rounds.map((r) => {
      const sc = r.scorecard as Partial<Scorecard> | null;
      return { score: r.score, minutes: plan[r.roundIndex]?.durationMinutes ?? 0, assessed: sc?.assessed ?? 0, total: sc?.total ?? 0 };
    }),
  );
  await prisma.$transaction([
    prisma.loopRun.update({
      where: { id: runId },
      data: { status: LoopRunStatus.COMPLETED, completedAt: run.completedAt ?? new Date(), overallScore: overall.score, assessedQuestions: overall.assessed, totalQuestions: overall.total },
    }),
    prisma.invite.updateMany({ where: { id: run.inviteId, completedAt: null }, data: { status: InviteStatus.COMPLETED, completedAt: new Date() } }),
  ]);
}

