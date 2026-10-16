import { z } from "zod";
import { LoopStatus, Prisma, QuestionCategory, QuestionStatus } from "@prisma/client";
import { prisma } from "./db";
import { liveRatesPerMinute } from "./aiCost";
import { estimateLoopCost as estimate, totalMinutes } from "./loopEstimate";
import { stableStringify } from "./stableJson";
import { CATEGORY_LABELS, LEVELS, usableQuestionsWhere } from "./questionBank";

export const MAX_ROUNDS = 8;
export const MAX_LOOP_MINUTES = 240;

const tagList = z.array(z.string().trim().toLowerCase().min(1).max(40)).max(10).default([]);

export const RoundQuestionsSchema = z.discriminatedUnion("mode", [
  /** Exactly these questions, in this order. */
  z.object({ mode: z.literal("fixed"), questionIds: z.array(z.string().min(1)).max(10) }),
  /** Pick `count` published questions that match, fresh for each candidate. */
  z.object({
    mode: z.literal("pool"),
    count: z.number().int().min(1).max(10),
    tags: tagList,
    roles: tagList,
    level: z.enum(LEVELS).nullable().default(null),
  }),
]);

export const RoundSchema = z.object({
  id: z.string().min(1).max(40),
  category: z.nativeEnum(QuestionCategory),
  title: z.string().trim().min(2, "Give every round a title.").max(80),
  durationMinutes: z.number().int().min(5).max(90),
  /** Shown to the candidate before the round starts. */
  candidateBrief: z.string().trim().max(500).default(""),
  questions: RoundQuestionsSchema,
});
export type LoopRoundConfig = z.infer<typeof RoundSchema>;

export const LoopEditSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).nullable().default(null),
  roleTarget: z.string().trim().max(80).nullable().default(null),
  level: z.enum(LEVELS).nullable().default(null),
  rounds: z
    .array(RoundSchema)
    .max(MAX_ROUNDS, `A loop can have at most ${MAX_ROUNDS} rounds.`)
    .refine((rs) => new Set(rs.map((r) => r.id)).size === rs.length, "Two rounds share an id. Reload the builder and try again."),
});
export type LoopEdit = z.infer<typeof LoopEditSchema>;

/** Rounds saved before the schema changed parse as empty rather than crashing the editor. */
export function parseRounds(raw: unknown): LoopRoundConfig[] {
  const parsed = z.array(RoundSchema).safeParse(raw);
  return parsed.success ? parsed.data : [];
}

/**
 * Rounds from a published version's snapshot. Published fixed rounds store
 * pinned versions instead of plain ids; this reads both, so callers never
 * have to know the difference.
 */
export function publishedRounds(snapshot: unknown): LoopRoundConfig[] {
  const rounds = (snapshot as { config?: { rounds?: unknown } } | null)?.config?.rounds;
  if (!Array.isArray(rounds)) return [];
  return parseRounds(
    rounds.map((r: { questions?: { mode?: string; pinned?: { questionId: string }[] } }) =>
      r?.questions?.mode === "fixed" && Array.isArray(r.questions.pinned)
        ? { ...r, questions: { mode: "fixed", questionIds: r.questions.pinned.map((p) => p.questionId) } }
        : r,
    ),
  );
}

/**
 * Which published questions a pool round can draw from: the loop owner's own
 * and, for a workspace, the inturview library. Untagged levels/roles mean "any".
 */
export function poolWhere(
  category: QuestionCategory,
  pool: { tags: string[]; roles: string[]; level: string | null },
  organizationId: string | null,
): Prisma.QuestionWhereInput {
  return {
    AND: [usableQuestionsWhere(organizationId)],
    category,
    status: QuestionStatus.PUBLISHED,
    ...(pool.tags.length && { tags: { hasEvery: pool.tags } }),
    ...(pool.level && { OR: [{ levels: { has: pool.level } }, { levels: { isEmpty: true } }] }),
    ...(pool.roles.length && {
      AND: [usableQuestionsWhere(organizationId), { OR: [{ roles: { hasSome: pool.roles } }, { roles: { isEmpty: true } }] }],
    }),
  };
}

export { totalMinutes, stableStringify };

/** Server-side estimate with the current per-minute rates. */
export const estimateLoopCost = (rounds: LoopRoundConfig[]) => estimate(rounds, liveRatesPerMinute());

export interface ReadinessFacts {
  /** Question id → its category and status, for every fixed question referenced. */
  fixed: Map<string, { category: QuestionCategory; status: QuestionStatus }>;
  /** Round id → how many published questions match its pool. */
  poolSizes: Map<string, number>;
}

/** Everything that stops a loop being published, in plain words. Pure; unit-tested. */
export function readinessProblems(rounds: LoopRoundConfig[], facts: ReadinessFacts): string[] {
  const problems: string[] = [];
  if (rounds.length === 0) problems.push("Add at least one round.");
  if (totalMinutes(rounds) > MAX_LOOP_MINUTES) problems.push(`The loop runs over ${MAX_LOOP_MINUTES / 60} hours. Shorten some rounds.`);
  rounds.forEach((r, i) => {
    const label = `Round ${i + 1} (${r.title || CATEGORY_LABELS[r.category]})`;
    if (r.questions.mode === "fixed") {
      if (r.questions.questionIds.length === 0) problems.push(`${label} has no questions.`);
      for (const id of r.questions.questionIds) {
        const q = facts.fixed.get(id);
        if (!q) problems.push(`${label} uses a question that no longer exists.`);
        else if (q.status !== QuestionStatus.PUBLISHED) problems.push(`${label} uses a question that isn't published.`);
        else if (q.category !== r.category) problems.push(`${label} uses a ${CATEGORY_LABELS[q.category].toLowerCase()} question in a ${CATEGORY_LABELS[r.category].toLowerCase()} round.`);
      }
    } else {
      const size = facts.poolSizes.get(r.id) ?? 0;
      if (size < r.questions.count) {
        problems.push(`${label} needs ${r.questions.count} matching questions but only ${size} are published.`);
      }
    }
  });
  return problems;
}

async function gatherFacts(
  rounds: LoopRoundConfig[],
  organizationId: string | null,
  db: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<ReadinessFacts> {
  const ids = [...new Set(rounds.flatMap((r) => (r.questions.mode === "fixed" ? r.questions.questionIds : [])))];
  // A question outside what this owner may use reads as "no longer exists".
  const rows = ids.length
    ? await db.question.findMany({
        where: { AND: [{ id: { in: ids } }, usableQuestionsWhere(organizationId)] },
        select: { id: true, category: true, status: true },
      })
    : [];
  const poolSizes = new Map<string, number>();
  for (const r of rounds) {
    if (r.questions.mode === "pool") poolSizes.set(r.id, await db.question.count({ where: poolWhere(r.category, r.questions, organizationId) }));
  }
  return { fixed: new Map(rows.map((q) => [q.id, { category: q.category, status: q.status }])), poolSizes };
}

export async function checkReadiness(rounds: LoopRoundConfig[], organizationId: string | null) {
  const facts = await gatherFacts(rounds, organizationId);
  return { problems: readinessProblems(rounds, facts), poolSizes: Object.fromEntries(facts.poolSizes) };
}

export class LoopNotReadyError extends Error {
  constructor(public problems: string[]) {
    super(problems[0] ?? "This loop isn't ready to publish.");
  }
}

/** Someone saved or published since the caller loaded the loop. */
export class LoopChangedError extends Error {
  constructor(public revision: number) {
    super("This loop changed since you opened it, in another tab or by a teammate. Reload to see the latest.");
  }
}

/** A status change that isn't allowed from the current status. */
export class LoopTransitionError extends Error {}

/** A full question copy as it was at publish time. Candidates are served from these. */
export interface FrozenLoopQuestion {
  questionId: string;
  version: number;
  title: string;
  prompt: string;
  followUps: string[];
  signals: string[];
  details: unknown;
  difficulty: string | null;
}

async function freezeVersions(db: Prisma.TransactionClient, refs: { id: string; currentVersion: number }[]): Promise<FrozenLoopQuestion[]> {
  if (refs.length === 0) return [];
  const rows = await db.questionVersion.findMany({
    where: { OR: refs.map((r) => ({ questionId: r.id, version: r.currentVersion })) },
    select: { questionId: true, version: true, snapshot: true },
  });
  return refs.flatMap((r) => {
    const v = rows.find((x) => x.questionId === r.id && x.version === r.currentVersion);
    if (!v) return [];
    const s = v.snapshot as { title: string; prompt: string; followUps: string[]; signals: string[]; details?: unknown; difficulty?: string | null };
    return [{ questionId: r.id, version: v.version, title: s.title, prompt: s.prompt, followUps: s.followUps ?? [], signals: s.signals ?? [], details: s.details ?? null, difficulty: s.difficulty ?? null }];
  });
}

/**
 * Freezes the loop: full copies of each fixed question, and of every question
 * each pool may draw from, at their current versions. `expectedRevision` is the
 * revision the publisher was looking at; publishing fails if it moved.
 * Re-publishing unchanged content is a no-op, like questions.
 */
export async function publishLoop(id: string, publishedById: string | null, expectedRevision?: number) {
  return prisma.$transaction(async (tx) => {
    const loop = await tx.loopTemplate.findUniqueOrThrow({ where: { id } });
    if (expectedRevision !== undefined && loop.revision !== expectedRevision) throw new LoopChangedError(loop.revision);
    if (loop.status === LoopStatus.ARCHIVED) throw new LoopNotReadyError(["Restore this loop before publishing it."]);
    const rounds = parseRounds(loop.rounds);
    const facts = await gatherFacts(rounds, loop.organizationId, tx);
    const problems = readinessProblems(rounds, facts);
    if (problems.length) throw new LoopNotReadyError(problems);

    const frozenRounds = [];
    for (const r of rounds) {
      if (r.questions.mode === "fixed") {
        const refs = await tx.question.findMany({ where: { id: { in: r.questions.questionIds } }, select: { id: true, currentVersion: true } });
        const ordered = r.questions.questionIds.map((qid) => refs.find((q) => q.id === qid)!);
        const frozen = await freezeVersions(tx, ordered);
        frozenRounds.push({ ...r, questions: { mode: "fixed" as const, pinned: frozen.map((q) => ({ questionId: q.questionId, version: q.version })), frozen } });
      } else {
        // Every candidate draws from exactly this set, whatever is published later.
        const eligible = await tx.question.findMany({ where: poolWhere(r.category, r.questions, loop.organizationId), select: { id: true, currentVersion: true }, orderBy: { id: "asc" } });
        frozenRounds.push({ ...r, questions: { ...r.questions, frozenPool: await freezeVersions(tx, eligible) } });
      }
    }
    const config = { name: loop.name, description: loop.description, roleTarget: loop.roleTarget, level: loop.level, rounds: frozenRounds };
    const latest = await tx.loopTemplateVersion.findFirst({ where: { loopTemplateId: id }, orderBy: { version: "desc" } });
    if (latest && stableStringify((latest.snapshot as { config?: unknown }).config) === stableStringify(config)) {
      return loop.status === LoopStatus.PUBLISHED
        ? loop
        : tx.loopTemplate.update({ where: { id }, data: { status: LoopStatus.PUBLISHED, revision: { increment: 1 } } });
    }
    const version = loop.currentVersion + 1;
    await tx.loopTemplateVersion.create({
      data: {
        loopTemplateId: id,
        version,
        snapshot: { format: 2, config, totalMinutes: totalMinutes(rounds), estimate: estimateLoopCost(rounds) } as unknown as Prisma.InputJsonValue,
        publishedById,
      },
    });
    return tx.loopTemplate.update({ where: { id }, data: { status: LoopStatus.PUBLISHED, currentVersion: version, revision: { increment: 1 } } });
  });
}

/**
 * Draft and published loops can be archived; only archived loops can be
 * restored (to published if they ever were, else draft).
 */
export async function setLoopArchived(id: string, archived: boolean, expectedRevision?: number) {
  const loop = await prisma.loopTemplate.findUniqueOrThrow({ where: { id }, select: { currentVersion: true, status: true, revision: true } });
  if (expectedRevision !== undefined && loop.revision !== expectedRevision) throw new LoopChangedError(loop.revision);
  if (archived && loop.status === LoopStatus.ARCHIVED) throw new LoopTransitionError("This loop is already archived.");
  if (!archived && loop.status !== LoopStatus.ARCHIVED) throw new LoopTransitionError("Only an archived loop can be restored.");
  const next = archived ? LoopStatus.ARCHIVED : loop.currentVersion > 0 ? LoopStatus.PUBLISHED : LoopStatus.DRAFT;
  const r = await prisma.loopTemplate.updateMany({ where: { id, revision: loop.revision }, data: { status: next, revision: { increment: 1 } } });
  if (r.count === 0) throw new LoopChangedError(loop.revision + 1);
  return prisma.loopTemplate.findUniqueOrThrow({ where: { id } });
}
