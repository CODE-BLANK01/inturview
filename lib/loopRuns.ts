import { InviteStatus, Prisma, QuestionCategory, RoundRunStatus } from "@prisma/client";
import { prisma } from "./db";
import type { Category } from "./analytics";
import { findInviteByToken } from "./invites";
import { poolWhere, publishedRounds, type LoopRoundConfig } from "./loopTemplates";
import { pickRandom, type FrozenQuestion } from "./loopRunEngine";
import type { QuestionSnapshot } from "./questionBank";
import { hardDeadline } from "./roundTiming";
import { campaignSnapshot } from "./loopSnapshot";

export const CATEGORY_TO_ANALYTICS: Record<QuestionCategory, Category> = {
  RECRUITER_SCREEN: "recruiter_screen",
  BEHAVIORAL: "behavioral",
  TECHNICAL: "technical",
  CODING: "coding",
  SYSTEM_DESIGN: "system_design",
};

export interface LoopContext {
  invite: Prisma.InviteGetPayload<{ include: { campaign: true; run: { include: { rounds: { orderBy: { roundIndex: "asc" } } } } } }>;
  /** The frozen loop this candidate runs (published version, or the previewed draft). */
  snapshot: unknown;
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
  const snapshot = await campaignSnapshot(invite.campaign);
  const config = (snapshot as { config?: Record<string, unknown> } | null)?.config;
  if (!config) throw new LoopAccessError("This interview isn't available right now.", 410);
  return {
    invite,
    snapshot,
    loop: {
      name: String(config.name ?? "Interview"),
      description: (config.description as string | null) ?? null,
      roleTarget: (config.roleTarget as string | null) ?? null,
      level: (config.level as string | null) ?? null,
      rounds: publishedRounds(snapshot),
    },
  };
}

/**
 * Analytics identity for an applicant. Applicants have no account: they are
 * the invite, and nothing links them to a practice user.
 */
export const applicantDistinctId = (inviteId: string) => `applicant:${inviteId}`;

/** A round as stored in a published version: format 2 carries full question copies. */
interface PublishedRound {
  id: string;
  questions: {
    mode: "fixed" | "pool";
    count?: number;
    pinned?: { questionId: string; version: number }[];
    frozen?: FrozenQuestion[];
    frozenPool?: FrozenQuestion[];
  };
}

const toFrozen = (q: FrozenQuestion): FrozenQuestion => ({
  questionId: q.questionId,
  version: q.version,
  title: q.title,
  prompt: q.prompt,
  followUps: q.followUps ?? [],
  signals: q.signals ?? [],
  details: q.details ?? null,
});

/**
 * The questions for one candidate's round. Format-2 versions serve the copies
 * frozen at publish: fixed rounds exactly, pool rounds drawn from the frozen
 * pool (avoiding questions this candidate already had). Older versions look
 * up pinned versions. Either way the round has its full count, or it doesn't start.
 */
async function frozenQuestions(
  round: LoopRoundConfig,
  published: PublishedRound | undefined,
  exclude: Set<string>,
  organizationId: string | null,
): Promise<FrozenQuestion[]> {
  const want = round.questions.mode === "fixed" ? round.questions.questionIds.length : round.questions.count;
  let picked: FrozenQuestion[];
  if (published?.questions.frozen) {
    picked = published.questions.frozen.map(toFrozen);
  } else if (published?.questions.frozenPool) {
    const pool = published.questions.frozenPool;
    const fresh = pool.filter((q) => !exclude.has(q.questionId));
    picked = pickRandom(fresh.length >= want ? fresh : pool, want).map(toFrozen);
  } else {
    picked = await legacyQuestions(round, published?.questions.pinned, exclude, organizationId);
  }
  if (picked.length < want) {
    // Never quietly run a shorter interview than the one the company set up.
    console.error("[loop] round can't be filled", { roundId: round.id, want, have: picked.length });
    throw new LoopAccessError("This round can't start because some of its questions are missing. Reply to the invitation email and the hiring team will sort it out.", 500);
  }
  return picked;
}

/** Versions published before full copies were frozen: resolve pinned versions, or pick a pool live. */
async function legacyQuestions(
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
  if (refs.length === 0) return [];
  const versions = await prisma.questionVersion.findMany({
    where: { OR: refs.map((r) => ({ questionId: r.questionId, version: r.version })) },
    select: { questionId: true, version: true, snapshot: true },
  });
  return refs.flatMap((r) => {
    const v = versions.find((x) => x.questionId === r.questionId && x.version === r.version);
    if (!v) return [];
    const s = v.snapshot as unknown as QuestionSnapshot;
    return [{ questionId: r.questionId, version: r.version, title: s.title, prompt: s.prompt, followUps: s.followUps, signals: s.signals, details: s.details ?? null }];
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
    try {
      run = await prisma.loopRun.create({
        data: { inviteId: ctx.invite.id, loopTemplateId: ctx.invite.campaign.loopTemplateId, loopVersion: ctx.invite.campaign.loopVersion },
        include: { rounds: { orderBy: { roundIndex: "asc" } } },
      });
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002") throw e;
      run = await prisma.loopRun.findUniqueOrThrow({ where: { inviteId: ctx.invite.id }, include: { rounds: { orderBy: { roundIndex: "asc" } } } });
    }
    await prisma.invite.updateMany({
      where: { id: ctx.invite.id, startedAt: null },
      data: { status: InviteStatus.STARTED, startedAt: new Date() },
    });
  }

  const publishedRound = (ctx.snapshot as unknown as { config: { rounds: PublishedRound[] } } | undefined)?.config.rounds.find((r) => r.id === round.id);
  const asked = new Set(existingRuns.flatMap((r) => (r.questions as unknown as FrozenQuestion[]).map((q) => q.questionId)));
  // The campaign belongs to the same workspace as its loop.
  const questions = await frozenQuestions(round, publishedRound, asked, ctx.invite.campaign.organizationId);

  try {
    const roundRun = await prisma.loopRoundRun.create({
      data: {
        runId: run.id,
        roundIndex: index,
        roundId: round.id,
        category: round.category,
        questions: questions as unknown as Prisma.InputJsonValue,
        deadlineAt: hardDeadline(new Date(), round.durationMinutes),
      },
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
