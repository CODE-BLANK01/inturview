import { InviteStatus, Prisma, QuestionCategory, RoundRunStatus } from "@prisma/client";
import { prisma } from "./db";
import type { Category } from "./analytics";
import { findInviteByToken } from "./invites";
import { poolWhere, publishedRounds, type LoopRoundConfig } from "./loopTemplates";
import { pickRandom, type FrozenQuestion } from "./loopRunEngine";
import type { QuestionSnapshot } from "./questionBank";
import { hardDeadline } from "./roundTiming";

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

/**
 * Analytics identity for an applicant. Applicants have no account: they are
 * the invite, and nothing links them to a practice user.
 */
export const applicantDistinctId = (inviteId: string) => `applicant:${inviteId}`;

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
