// Reviewing candidates: notes, ratings, decisions and reviewer assignments.
// The log (Review) is append-only. Reviewers only reach candidates assigned to them.
import { NextRequest } from "next/server";
import { z } from "zod";
import { Decision, ReviewKind } from "@prisma/client";
import { prisma } from "../db";
import { writeAudit } from "../audit";
import type { HiringCtx } from "./handlers";

const json = (body: unknown, status = 200) => Response.json(body, { status });
const notFound = () => json({ error: "Candidate not found" }, 404);
const body = (req: NextRequest) => req.json().catch(() => null);

/** The candidate, if this viewer may see it: anyone with full access, or a reviewer it's assigned to. */
export async function visibleCandidate(organizationId: string, inviteId: string, viewer: { userId: string; canViewAll: boolean }) {
  return prisma.invite.findFirst({
    where: {
      id: inviteId,
      campaign: { organizationId },
      ...(!viewer.canViewAll && { assignments: { some: { userId: viewer.userId } } }),
    },
    select: { id: true, status: true },
  });
}

async function guard(ctx: HiringCtx, inviteId: string) {
  if (!ctx.organizationId) return null;
  return visibleCandidate(ctx.organizationId, inviteId, { userId: ctx.actorId, canViewAll: !!ctx.canViewAll });
}

const audit = (ctx: HiringCtx, action: Parameters<typeof writeAudit>[0]["action"], inviteId: string, metadata: Record<string, unknown> = {}) =>
  writeAudit({ adminId: ctx.actorId, action, targetType: "invite", targetId: inviteId, metadata: { ...metadata, organizationId: ctx.organizationId } });

const Note = z.object({ body: z.string().trim().min(1, "Write a note first.").max(4000) });
const Rating = z.object({ rating: z.number().int().min(1).max(5), body: z.string().trim().max(2000).optional() });
const DecisionBody = z.object({ decision: z.nativeEnum(Decision), body: z.string().trim().max(2000).optional() });
const Assign = z.object({ userId: z.string().min(1) });

export async function addNoteHandler(ctx: HiringCtx, req: NextRequest, inviteId: string) {
  const parsed = Note.safeParse(await body(req));
  if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? "Invalid note" }, 400);
  if (!(await guard(ctx, inviteId))) return notFound();
  const r = await prisma.review.create({ data: { inviteId, authorId: ctx.actorId, kind: ReviewKind.NOTE, body: parsed.data.body } });
  await audit(ctx, "REVIEW_NOTE_ADDED", inviteId, { reviewId: r.id });
  return json({ id: r.id }, 201);
}

/** A new rating replaces the person's earlier one for display; both stay in the log. */
export async function rateHandler(ctx: HiringCtx, req: NextRequest, inviteId: string) {
  const parsed = Rating.safeParse(await body(req));
  if (!parsed.success) return json({ error: "Pick a rating from 1 to 5." }, 400);
  if (!(await guard(ctx, inviteId))) return notFound();
  const r = await prisma.review.create({
    data: { inviteId, authorId: ctx.actorId, kind: ReviewKind.RATING, rating: parsed.data.rating, body: parsed.data.body || null },
  });
  await audit(ctx, "REVIEW_RATED", inviteId, { rating: parsed.data.rating });
  return json({ id: r.id }, 201);
}

export async function decideHandler(ctx: HiringCtx, req: NextRequest, inviteId: string) {
  const parsed = DecisionBody.safeParse(await body(req));
  if (!parsed.success) return json({ error: "Choose advance or decline." }, 400);
  const invite = await guard(ctx, inviteId);
  if (!invite) return notFound();
  if (invite.status === "REVOKED") return json({ error: "This invite was cancelled." }, 409);
  const now = new Date();
  await prisma.$transaction([
    prisma.review.create({ data: { inviteId, authorId: ctx.actorId, kind: ReviewKind.DECISION, decision: parsed.data.decision, body: parsed.data.body || null } }),
    prisma.invite.update({ where: { id: inviteId }, data: { decision: parsed.data.decision, decidedAt: now, decidedById: ctx.actorId } }),
  ]);
  await audit(ctx, "CANDIDATE_DECIDED", inviteId, { decision: parsed.data.decision });
  return json({ ok: true, decision: parsed.data.decision });
}

export async function assignHandler(ctx: HiringCtx, req: NextRequest, inviteId: string) {
  const parsed = Assign.safeParse(await body(req));
  if (!parsed.success) return json({ error: "Pick a teammate." }, 400);
  if (!ctx.organizationId || !(await guard(ctx, inviteId))) return notFound();
  // Only people in this workspace can be assigned.
  const member = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId: ctx.organizationId, userId: parsed.data.userId } },
    select: { id: true },
  });
  if (!member) return json({ error: "That person isn't in this workspace." }, 400);
  await prisma.reviewerAssignment.upsert({
    where: { inviteId_userId: { inviteId, userId: parsed.data.userId } },
    create: { inviteId, userId: parsed.data.userId, assignedById: ctx.actorId },
    update: {},
  });
  await audit(ctx, "REVIEWER_ASSIGNED", inviteId, { userId: parsed.data.userId });
  return json({ ok: true });
}

export async function unassignHandler(ctx: HiringCtx, req: NextRequest, inviteId: string) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return json({ error: "Pick a teammate." }, 400);
  if (!(await guard(ctx, inviteId))) return notFound();
  await prisma.reviewerAssignment.deleteMany({ where: { inviteId, userId } });
  await audit(ctx, "REVIEWER_UNASSIGNED", inviteId, { userId });
  return json({ ok: true });
}

export interface ReviewPanelData {
  decision: { value: Decision; at: Date; by: string | null } | null;
  feed: { id: string; kind: ReviewKind; author: string; body: string | null; rating: number | null; decision: Decision | null; at: Date }[];
  ratings: { mine: number | null; average: number | null; count: number; others: { author: string; rating: number }[] | null };
  assigned: { userId: string; name: string }[];
  members: { userId: string; name: string }[];
}

const display = (u: { name: string | null; email: string } | null) => (u ? u.name || u.email : "Former teammate");

/**
 * What the review panel shows this viewer. Ratings are blind: until you've
 * rated, you see how many teammates rated but not what they gave.
 */
export async function reviewPanel(organizationId: string, inviteId: string, viewerId: string, seesAllRatings: boolean): Promise<ReviewPanelData> {
  const [invite, reviews, assignments, members] = await Promise.all([
    prisma.invite.findUniqueOrThrow({ where: { id: inviteId }, select: { decision: true, decidedAt: true, decidedById: true } }),
    prisma.review.findMany({ where: { inviteId }, orderBy: { createdAt: "asc" }, include: { author: { select: { name: true, email: true } } } }),
    prisma.reviewerAssignment.findMany({ where: { inviteId }, include: { user: { select: { name: true, email: true } } } }),
    prisma.organizationMember.findMany({ where: { organizationId }, include: { user: { select: { name: true, email: true } } }, orderBy: { createdAt: "asc" } }),
  ]);
  // Each person's latest rating counts.
  const latest = new Map<string, { author: string; rating: number }>();
  for (const r of reviews) if (r.kind === ReviewKind.RATING && r.rating && r.authorId) latest.set(r.authorId, { author: display(r.author), rating: r.rating });
  const mine = latest.get(viewerId)?.rating ?? null;
  const all = [...latest.values()];
  const reveal = seesAllRatings || mine !== null;
  const decider = invite.decidedById ? members.find((m) => m.userId === invite.decidedById) : null;
  return {
    decision: invite.decision && invite.decidedAt ? { value: invite.decision, at: invite.decidedAt, by: decider ? display(decider.user) : null } : null,
    // Ratings in the feed follow the same blind rule.
    feed: reviews
      .filter((r) => reveal || r.kind !== ReviewKind.RATING || r.authorId === viewerId)
      .map((r) => ({ id: r.id, kind: r.kind, author: display(r.author), body: r.body, rating: r.rating, decision: r.decision, at: r.createdAt })),
    ratings: {
      mine,
      count: all.length,
      average: reveal && all.length ? Math.round((all.reduce((a, r) => a + r.rating, 0) / all.length) * 10) / 10 : null,
      others: reveal ? [...latest.entries()].filter(([id]) => id !== viewerId).map(([, v]) => v) : null,
    },
    assigned: assignments.map((a) => ({ userId: a.userId, name: display(a.user) })),
    members: members.map((m) => ({ userId: m.userId, name: display(m.user) })),
  };
}
