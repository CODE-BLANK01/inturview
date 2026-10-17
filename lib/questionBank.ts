import { z } from "zod";
import { Prisma, QuestionCategory, QuestionSource, QuestionStatus } from "@prisma/client";
import { prisma } from "./db";
import { stableStringify } from "./stableJson";

export const CATEGORY_LABELS: Record<QuestionCategory, string> = {
  RECRUITER_SCREEN: "Recruiter screen",
  BEHAVIORAL: "Behavioral",
  TECHNICAL: "Technical deep-dive",
  CODING: "Coding",
  SYSTEM_DESIGN: "System design",
};

export const LEVELS = ["junior", "mid", "senior"] as const;
export const DIFFICULTIES = ["Easy", "Medium", "Hard"] as const;

const line = (max: number) => z.string().trim().min(2).max(max);

/** Everything an editor can change. Shared by the admin API, imports and AI drafts. */
export const QuestionInputSchema = z.object({
  category: z.nativeEnum(QuestionCategory),
  title: z.string().trim().min(3).max(160),
  prompt: z.string().trim().min(10).max(4000),
  followUps: z.array(line(500)).max(10).default([]),
  signals: z.array(line(300)).max(12).default([]),
  levels: z.array(z.enum(LEVELS)).default([]),
  roles: z.array(line(40)).max(10).default([]),
  tags: z.array(line(40)).max(15).default([]),
  difficulty: z.enum(DIFFICULTIES).nullable().default(null),
  details: z.record(z.unknown()).nullable().default(null),
});
export type QuestionInput = z.infer<typeof QuestionInputSchema>;

/** The content a version freezes. Loops render from this, never the live row. */
export interface QuestionSnapshot {
  category: QuestionCategory;
  title: string;
  prompt: string;
  followUps: string[];
  signals: string[];
  levels: string[];
  roles: string[];
  tags: string[];
  difficulty: string | null;
  details: unknown;
}

export function snapshotOf(q: QuestionSnapshot): QuestionSnapshot {
  return {
    category: q.category,
    title: q.title,
    prompt: q.prompt,
    followUps: [...q.followUps],
    signals: [...q.signals],
    levels: [...q.levels],
    roles: [...q.roles],
    tags: [...q.tags],
    difficulty: q.difficulty ?? null,
    details: q.details ?? null,
  };
}

/** True when the live question differs from what was last published. */
export function hasUnpublishedChanges(live: QuestionSnapshot, published: QuestionSnapshot | null): boolean {
  if (!published) return true;
  return stableStringify(snapshotOf(live)) !== stableStringify(snapshotOf(published));
}

function toData(input: QuestionInput) {
  return {
    ...input,
    details: input.details === null ? Prisma.JsonNull : (input.details as Prisma.InputJsonValue),
  };
}

export async function createQuestion(
  input: QuestionInput,
  opts: { createdById?: string | null; source?: QuestionSource; organizationId?: string | null; sourceKey?: string },
) {
  return prisma.question.create({
    data: {
      ...toData(input),
      source: opts.source ?? QuestionSource.ADMIN,
      createdById: opts.createdById ?? null,
      organizationId: opts.organizationId ?? null,
      sourceKey: opts.sourceKey,
    },
  });
}

export async function updateQuestion(id: string, input: QuestionInput) {
  return prisma.question.update({ where: { id }, data: toData(input) });
}

/**
 * Freezes the current content as the next version. A unique (questionId, version)
 * index makes a double-click publish fail instead of creating two versions.
 */
export class QuestionRetiredError extends Error {
  constructor() {
    super("Restore this question before publishing it.");
  }
}

export async function publishQuestion(id: string, publishedById: string | null) {
  return prisma.$transaction(async (tx) => {
    const q = await tx.question.findUniqueOrThrow({ where: { id } });
    if (q.status === QuestionStatus.RETIRED) throw new QuestionRetiredError();
    // Publishing unchanged content (a double click, a stale tab) is a no-op.
    const latest = await tx.questionVersion.findFirst({ where: { questionId: id }, orderBy: { version: "desc" } });
    if (latest && !hasUnpublishedChanges(q as unknown as QuestionSnapshot, latest.snapshot as unknown as QuestionSnapshot)) {
      return q.status === QuestionStatus.PUBLISHED
        ? q
        : tx.question.update({ where: { id }, data: { status: QuestionStatus.PUBLISHED } });
    }
    const version = q.currentVersion + 1;
    await tx.questionVersion.create({
      data: {
        questionId: id,
        version,
        snapshot: snapshotOf(q) as unknown as Prisma.InputJsonValue,
        publishedById,
      },
    });
    return tx.question.update({
      where: { id },
      data: { status: QuestionStatus.PUBLISHED, currentVersion: version },
    });
  });
}

/** Retired questions stay readable for loops already using them; new loops can't pick them. */
export async function retireQuestion(id: string) {
  return prisma.question.update({ where: { id }, data: { status: QuestionStatus.RETIRED } });
}

export async function restoreQuestion(id: string) {
  const q = await prisma.question.findUniqueOrThrow({ where: { id }, select: { currentVersion: true } });
  return prisma.question.update({
    where: { id },
    data: { status: q.currentVersion > 0 ? QuestionStatus.PUBLISHED : QuestionStatus.DRAFT },
  });
}

export interface QuestionFilters {
  category?: QuestionCategory;
  status?: QuestionStatus;
  source?: QuestionSource;
  q?: string;
}

/**
 * Questions a workspace's loops may use: its own plus the published inturview
 * library. `null` is the platform itself, which only uses its own.
 * Another workspace's questions are never included.
 */
export function usableQuestionsWhere(organizationId: string | null): Prisma.QuestionWhereInput {
  return organizationId
    ? { OR: [{ organizationId }, { organizationId: null, status: QuestionStatus.PUBLISHED }] }
    : { organizationId: null };
}

/** Questions owned by `organizationId` (null: the platform library), filtered. */
export function questionWhere(f: QuestionFilters, organizationId: string | null): Prisma.QuestionWhereInput {
  return { organizationId, ...questionFilterWhere(f) };
}

/** Just the filters, for combining with an ownership or usability condition. */
export function questionFilterWhere(f: QuestionFilters): Prisma.QuestionWhereInput {
  return {
    ...(f.category && { category: f.category }),
    ...(f.status && { status: f.status }),
    ...(f.source && { source: f.source }),
    ...(f.q && {
      OR: [
        { title: { contains: f.q, mode: "insensitive" } },
        { prompt: { contains: f.q, mode: "insensitive" } },
        { tags: { has: f.q.toLowerCase() } },
      ],
    }),
  };
}
