// Applicant data retention, export and deletion (decision D4).
//
// What candidates are told: their answers are kept for up to N months after a
// decision (N is the company's setting, at most 12), or after their interview
// if no decision is made, then deleted. "Deleted" means the transcript,
// scores, notes, ratings, deliveries, link and name/email are gone; a bare row
// (status, decision, dates) stays so the company's funnel counts still add up.
import { prisma } from "./db";

export const MAX_RETENTION_MONTHS = 12;
/** A teammate's preview is their own test data: kept a week. */
export const PREVIEW_RETENTION_DAYS = 7;

export function addMonths(d: Date, months: number): Date {
  const r = new Date(d.getTime());
  r.setUTCMonth(r.getUTCMonth() + months);
  return r;
}

/** When this applicant's data is due for deletion. Pure; unit-tested. */
export function deletionDue(
  i: { decidedAt: Date | null; completedAt: Date | null; expiresAt: Date | null; createdAt: Date },
  months: number,
  preview = false,
): Date {
  if (preview) return new Date(i.createdAt.getTime() + PREVIEW_RETENTION_DAYS * 86_400_000);
  // The decision starts the clock; without one, the end of the interview (or of the link).
  const from = i.decidedAt ?? i.completedAt ?? i.expiresAt ?? i.createdAt;
  return addMonths(from, Math.min(Math.max(1, months), MAX_RETENTION_MONTHS));
}

/** Deletes one applicant's data. Idempotent. */
export async function redactApplicant(inviteId: string) {
  const now = new Date();
  await prisma.$transaction([
    prisma.loopRun.deleteMany({ where: { inviteId } }), // rounds, messages and scoring attempts cascade
    prisma.review.deleteMany({ where: { inviteId } }),
    prisma.reviewerAssignment.deleteMany({ where: { inviteId } }),
    prisma.delivery.deleteMany({ where: { inviteId } }),
    prisma.invite.update({
      where: { id: inviteId },
      data: { name: null, email: `deleted+${inviteId}@redacted.invalid`, tokenHash: null, lastError: null, redactedAt: now },
    }),
  ]);
}

/** Everything held about one applicant, for a data request. */
export async function exportApplicant(inviteId: string) {
  const invite = await prisma.invite.findUniqueOrThrow({
    where: { id: inviteId },
    include: {
      campaign: { select: { name: true, hiringRole: { select: { title: true } }, organization: { select: { name: true } } } },
      run: { include: { rounds: { orderBy: { roundIndex: "asc" }, include: { messages: { orderBy: { createdAt: "asc" }, select: { role: true, content: true, createdAt: true } } } } } },
      reviews: { orderBy: { createdAt: "asc" }, select: { kind: true, body: true, rating: true, decision: true, createdAt: true, author: { select: { name: true, email: true } } } },
    },
  });
  return {
    exportedAt: new Date().toISOString(),
    company: invite.campaign.organization?.name ?? null,
    role: invite.campaign.hiringRole?.title ?? null,
    applicant: { name: invite.name, email: invite.email },
    status: invite.status,
    decision: invite.decision,
    timeline: { invitedAt: invite.createdAt, sentAt: invite.sentAt, openedAt: invite.openedAt, consentedAt: invite.consentedAt, startedAt: invite.startedAt, completedAt: invite.completedAt, decidedAt: invite.decidedAt },
    overallScore: invite.run?.overallScore ?? null,
    rounds: (invite.run?.rounds ?? []).map((r) => ({
      round: r.roundIndex + 1,
      status: r.status,
      score: r.score,
      scorecard: r.scorecard,
      transcript: r.messages.map((m) => ({ speaker: m.role, text: m.content, at: m.createdAt })),
    })),
    reviews: invite.reviews.map((r) => ({ kind: r.kind, by: r.author?.name || r.author?.email || "Former teammate", body: r.body, rating: r.rating, decision: r.decision, at: r.createdAt })),
  };
}

/**
 * Deletes applicants whose retention ran out. Run by the worker; bounded per
 * call. The date maths is in SQL on UTC strings (see lib/delivery.ts).
 */
export async function purgeExpiredApplicants(limit = 100, now = new Date()): Promise<number> {
  const at = now.toISOString();
  const due = await prisma.$queryRaw<{ id: string }[]>`
    SELECT i."id" FROM "Invite" i
    JOIN "Campaign" c ON c."id" = i."campaignId"
    LEFT JOIN "Organization" o ON o."id" = c."organizationId"
    WHERE i."redactedAt" IS NULL
      AND (
        (c."preview" AND i."createdAt" + make_interval(days => ${PREVIEW_RETENTION_DAYS}::int) < ${at}::timestamp)
        OR (NOT c."preview" AND COALESCE(i."decidedAt", i."completedAt", i."expiresAt", i."createdAt")
            + make_interval(months => LEAST(GREATEST(COALESCE(o."retentionMonths", ${MAX_RETENTION_MONTHS}::int), 1), ${MAX_RETENTION_MONTHS}::int)) < ${at}::timestamp)
      )
    LIMIT ${limit}::int`;
  for (const { id } of due) await redactApplicant(id);
  return due.length;
}
