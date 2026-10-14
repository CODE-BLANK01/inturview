import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { InviteStatus, LoopRunStatus, Prisma, QuestionCategory, RoundRunStatus } from "@prisma/client";
import { prisma } from "./db";
import { getAnthropic, MODEL } from "./anthropic";
import { trackClaudeUsage, type ClaudeUsage } from "./aiCost";
import type { Category } from "./analytics";
import { findInviteByToken } from "./invites";
import { poolWhere, publishedRounds, type LoopRoundConfig } from "./loopTemplates";
import { overallScore, parseScorecard, pickRandom, scoringPrompt, type FrozenQuestion } from "./loopRunEngine";
import type { QuestionSnapshot } from "./questionBank";

export const CATEGORY_TO_ANALYTICS: Record<QuestionCategory, Category> = {
  RECRUITER_SCREEN: "recruiter_screen",
  BEHAVIORAL: "behavioral",
  TECHNICAL: "technical",
  CODING: "coding",
  SYSTEM_DESIGN: "system_design",
};

export interface LoopContext {
  invite: Prisma.InviteGetPayload<{ include: { campaign: true; run: { include: { rounds: { orderBy: { roundIndex: "asc" } } } } } }>;
  loop: { name: string; description: string | null; roleTarget: string | null; level: string | null; rounds: LoopRoundConfig[] };
}

export class LoopAccessError extends Error {
  constructor(message: string, public status = 403) {
    super(message);
  }
}

/** Everything a candidate request needs, from the link token alone. The link is the credential. */
export async function loadLoopContext(token: string): Promise<LoopContext> {
  const found = await findInviteByToken(token);
  if (!found.ok) throw new LoopAccessError(found.reason === "expired" ? "This link has expired." : "This link no longer works.", 410);
  const invite = await prisma.invite.findUniqueOrThrow({
    where: { id: found.invite.id },
    include: { campaign: true, run: { include: { rounds: { orderBy: { roundIndex: "asc" } } } } },
  });
  if (!invite.consentedAt) throw new LoopAccessError("Agree to the interview terms first.", 409);
  const version = await prisma.loopTemplateVersion.findUnique({
    where: { loopTemplateId_version: { loopTemplateId: invite.campaign.loopTemplateId, version: invite.campaign.loopVersion } },
  });
  const config = (version?.snapshot as { config?: Record<string, unknown> } | null)?.config;
  if (!config) throw new LoopAccessError("This interview isn't available right now.", 410);
  return {
    invite,
    loop: {
      name: String(config.name ?? "Interview"),
      description: (config.description as string | null) ?? null,
      roleTarget: (config.roleTarget as string | null) ?? null,
      level: (config.level as string | null) ?? null,
      rounds: publishedRounds(version?.snapshot),
    },
  };
}

/** The candidate's account: created on first start, or the existing one with that email. */
async function candidateUserId(email: string, name: string | null): Promise<string> {
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return existing.id;
  // An unguessable password they never see; "Forgot password" lets them claim the account later.
  const passwordHash = await bcrypt.hash(randomBytes(24).toString("base64url"), 10);
  try {
    const user = await prisma.user.create({
      data: { email, name, passwordHash, emailVerifiedAt: new Date(), onboardingCompletedAt: new Date() },
      select: { id: true },
    });
    return user.id;
  } catch (e) {
    // Two requests (double click, two tabs) created it at the same moment; use the winner.
    if ((e as { code?: string }).code === "P2002") return (await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true } })).id;
    throw e;
  }
}

async function frozenQuestions(
  round: LoopRoundConfig,
  pinned: { questionId: string; version: number }[] | undefined,
  exclude: Set<string>,
  organizationId: string | null,
): Promise<FrozenQuestion[]> {
  let refs: { questionId: string; version: number }[];
  if (round.questions.mode === "fixed") {
    refs = pinned ?? [];
  } else {
    const candidates = await prisma.question.findMany({ where: poolWhere(round.category, round.questions, organizationId), select: { id: true, currentVersion: true } });
    const fresh = candidates.filter((c) => !exclude.has(c.id));
    refs = pickRandom(fresh.length >= round.questions.count ? fresh : candidates, round.questions.count).map((c) => ({ questionId: c.id, version: c.currentVersion }));
  }
  const versions = await prisma.questionVersion.findMany({
    where: { OR: refs.map((r) => ({ questionId: r.questionId, version: r.version })) },
    select: { questionId: true, version: true, snapshot: true },
  });
  return refs.flatMap((r) => {
    const v = versions.find((x) => x.questionId === r.questionId && x.version === r.version);
    if (!v) return [];
    const s = v.snapshot as unknown as QuestionSnapshot;
    return [{ questionId: r.questionId, version: r.version, title: s.title, prompt: s.prompt, followUps: s.followUps, signals: s.signals }];
  });
}

/**
 * Starts (or resumes) round `index`. Rounds go in order: a round opens only
 * after the previous one is done.
 */
export async function startRound(ctx: LoopContext, index: number) {
  const round = ctx.loop.rounds[index];
  if (!round) throw new LoopAccessError("That round doesn't exist.", 404);
  const existingRuns = ctx.invite.run?.rounds ?? [];
  const already = existingRuns.find((r) => r.roundIndex === index);
  if (already) return { roundRun: already, created: false };
  const previousDone = index === 0 || existingRuns.some((r) => r.roundIndex === index - 1 && r.status !== RoundRunStatus.IN_PROGRESS);
  if (!previousDone) throw new LoopAccessError("Finish the previous round first.", 409);

  let run = ctx.invite.run;
  if (!run) {
    const userId = await candidateUserId(ctx.invite.email, ctx.invite.name);
    try {
      run = await prisma.loopRun.create({
        data: { inviteId: ctx.invite.id, userId, loopTemplateId: ctx.invite.campaign.loopTemplateId, loopVersion: ctx.invite.campaign.loopVersion },
        include: { rounds: { orderBy: { roundIndex: "asc" } } },
      });
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002") throw e;
      run = await prisma.loopRun.findUniqueOrThrow({ where: { inviteId: ctx.invite.id }, include: { rounds: { orderBy: { roundIndex: "asc" } } } });
    }
    await prisma.invite.updateMany({
      where: { id: ctx.invite.id, startedAt: null },
      data: { userId, status: InviteStatus.STARTED, startedAt: new Date() },
    });
  }

  const versionRow = await prisma.loopTemplateVersion.findUnique({
    where: { loopTemplateId_version: { loopTemplateId: ctx.invite.campaign.loopTemplateId, version: ctx.invite.campaign.loopVersion } },
    select: { snapshot: true },
  });
  const publishedRound = ((versionRow?.snapshot as { config: { rounds: { id: string; questions: { pinned?: { questionId: string; version: number }[] } }[] } }).config.rounds).find((r) => r.id === round.id);
  const asked = new Set(existingRuns.flatMap((r) => (r.questions as unknown as FrozenQuestion[]).map((q) => q.questionId)));
  // The campaign belongs to the same workspace as its loop.
  const questions = await frozenQuestions(round, publishedRound?.questions.pinned, asked, ctx.invite.campaign.organizationId);
  if (questions.length === 0) throw new LoopAccessError("This round has no questions available. Reply to the invitation email and we'll sort it out.", 500);

  try {
    const roundRun = await prisma.loopRoundRun.create({
      data: { runId: run.id, roundIndex: index, roundId: round.id, category: round.category, questions: questions as unknown as Prisma.InputJsonValue },
    });
    return { roundRun, created: true };
  } catch (e) {
    // Two tabs started the same round at once; use the one that won.
    if ((e as { code?: string }).code === "P2002") {
      return { roundRun: await prisma.loopRoundRun.findUniqueOrThrow({ where: { runId_roundIndex: { runId: run.id, roundIndex: index } } }), created: false };
    }
    throw e;
  }
}

/** Scores a finished round. Safe to call twice: only one caller moves it to SCORING. */
export async function finishRound(roundRunId: string, distinctUserId: string) {
  const claimed = await prisma.loopRoundRun.updateMany({
    where: { id: roundRunId, status: RoundRunStatus.IN_PROGRESS },
    data: { status: RoundRunStatus.SCORING, completedAt: new Date() },
  });
  if (claimed.count === 0) return prisma.loopRoundRun.findUniqueOrThrow({ where: { id: roundRunId } });
  return scoreRound(roundRunId, distinctUserId);
}

/** Grades the transcript against each question's signals. A failure leaves the round in SCORING for a re-score. */
export async function scoreRound(roundRunId: string, distinctUserId: string) {
  const rr = await prisma.loopRoundRun.findUniqueOrThrow({
    where: { id: roundRunId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  const questions = rr.questions as unknown as FrozenQuestion[];
  const candidateSpoke = rr.messages.some((m) => m.role === "candidate" && m.content.trim().length > 0);
  let scorecard = null;
  if (candidateSpoke) {
    try {
      const { system, user } = scoringPrompt(questions, rr.messages);
      const resp = await getAnthropic().messages.create({ model: MODEL, max_tokens: 2000, system, messages: [{ role: "user", content: user }] });
      await trackClaudeUsage(distinctUserId, { category: CATEGORY_TO_ANALYTICS[rr.category], sessionId: rr.id, model: MODEL, purpose: "debrief", usage: resp.usage as ClaudeUsage });
      scorecard = parseScorecard(resp.content.map((b) => (b.type === "text" ? b.text : "")).join(""), questions.map((q) => q.questionId));
    } catch (e) {
      console.error("[loop/score] grader failed:", e instanceof Error ? e.message : e);
      return rr;
    }
    if (!scorecard) {
      console.error("[loop/score] grader reply couldn't be parsed", { roundRunId });
      return rr;
    }
  }
  const updated = await prisma.loopRoundRun.update({
    where: { id: roundRunId },
    data: {
      status: RoundRunStatus.COMPLETED,
      scorecard: (scorecard ?? { questions: [], overall: 0, strengths: [], improvements: [], summary: "The candidate didn't answer any questions." }) as unknown as Prisma.InputJsonValue,
      score: scorecard?.overall ?? 0,
    },
  });
  await maybeCompleteRun(rr.runId);
  return updated;
}

async function maybeCompleteRun(runId: string) {
  const run = await prisma.loopRun.findUniqueOrThrow({
    where: { id: runId },
    include: { rounds: true, invite: { include: { campaign: { select: { loopTemplateId: true, loopVersion: true } } } } },
  });
  const version = await prisma.loopTemplateVersion.findUnique({
    where: { loopTemplateId_version: { loopTemplateId: run.loopTemplateId, version: run.loopVersion } },
    select: { snapshot: true },
  });
  const total = ((version?.snapshot as { config?: { rounds?: unknown[] } } | null)?.config?.rounds ?? []).length;
  if (run.rounds.length < total || run.rounds.some((r) => r.status !== RoundRunStatus.COMPLETED)) return;
  const overall = overallScore(run.rounds.map((r) => r.score));
  await prisma.$transaction([
    prisma.loopRun.update({ where: { id: runId }, data: { status: LoopRunStatus.COMPLETED, completedAt: new Date(), overallScore: overall } }),
    prisma.invite.update({ where: { id: run.inviteId }, data: { status: InviteStatus.COMPLETED, completedAt: new Date() } }),
  ]);
}
