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
import { campaignSnapshot, SNAPSHOT_FIELDS } from "./loopSnapshot";
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
  const r = await prisma.loopRoundRun.updateMany({
    where: { id: roundRunId, status: RoundRunStatus.SCORING },
    data: previous
      ? { status: RoundRunStatus.COMPLETED, scorecard: previous.scorecard ?? Prisma.JsonNull, score: previous.score }
      : { status: RoundRunStatus.SCORING_FAILED },
  });
  // Putting the earlier score back can be what completes the interview (other
  // rounds may have finished while this one was being re-scored).
  if (r.count && previous) {
    const rr = await prisma.loopRoundRun.findUniqueOrThrow({ where: { id: roundRunId }, select: { runId: true } });
    await refreshRun(rr.runId);
  }
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

/**
 * The candidate finished a round (or its time ran out, or the interviewer
 * closed it). Moving to SCORING and queuing the score job happen in one
 * transaction, so a round can't be left scoring with nothing to score it.
 * Safe to call again: a round already scoring gets its job re-queued if it
 * lost it. `inline: false` just queues, for callers that shouldn't wait on the model.
 */
export async function finishRound(roundRunId: string, grade?: Grader, opts: { inline?: boolean } = {}) {
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.loopRoundRun.updateMany({
      where: { id: roundRunId, status: RoundRunStatus.IN_PROGRESS },
      data: { status: RoundRunStatus.SCORING, completedAt: new Date(), draft: null },
    });
    if (claimed.count) await enqueueJob(SCORE_JOB, jobKey(roundRunId), { roundRunId }, { db: tx });
  });
  const rr = await prisma.loopRoundRun.findUniqueOrThrow({ where: { id: roundRunId } });
  if (rr.status !== RoundRunStatus.SCORING) return rr;
  // No-op when the job is already queued or running (one active job per key).
  await enqueueJob(SCORE_JOB, jobKey(roundRunId), { roundRunId });
  if (opts.inline === false) return rr;
  await processJobs(scoringHandlers(grade), { key: jobKey(roundRunId), limit: 1 });
  return prisma.loopRoundRun.findUniqueOrThrow({ where: { id: roundRunId } });
}

/** Rounds left scoring with no queued or running job (a crash, an old bug) get one. */
export async function recoverOrphanedScoring(limit = 50) {
  const scoring = await prisma.loopRoundRun.findMany({ where: { status: RoundRunStatus.SCORING }, select: { id: true }, take: limit });
  if (scoring.length === 0) return 0;
  const active = new Set(
    (await prisma.job.findMany({ where: { key: { in: scoring.map((r) => jobKey(r.id)) }, state: { in: ["QUEUED", "RUNNING"] } }, select: { key: true } })).map((j) => j.key),
  );
  const orphans = scoring.filter((r) => !active.has(jobKey(r.id)));
  for (const r of orphans) await enqueueJob(SCORE_JOB, jobKey(r.id), { roundRunId: r.id });
  return orphans.length;
}

/** Rounds left open past their hard deadline (the candidate walked away) get finished and scored. */
export async function finishOverdueRounds(limit = 20) {
  const overdue = await prisma.loopRoundRun.findMany({
    where: { status: RoundRunStatus.IN_PROGRESS, deadlineAt: { lt: new Date() } },
    take: limit,
    select: { id: true },
  });
  for (const r of overdue) await finishRound(r.id, undefined, { inline: false });
  return overdue.length;
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
  const run = await prisma.loopRun.findUniqueOrThrow({ where: { id: runId }, include: { rounds: true, invite: { select: { campaign: { select: SNAPSHOT_FIELDS } } } } });
  const plan = publishedRounds(await campaignSnapshot(run.invite.campaign));
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
    // A cancelled invite stays cancelled, even if its last grade lands afterwards.
    prisma.invite.updateMany({
      where: { id: run.inviteId, completedAt: null, status: { not: InviteStatus.REVOKED } },
      data: { status: InviteStatus.COMPLETED, completedAt: new Date() },
    }),
  ]);
}

