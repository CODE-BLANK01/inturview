// Invite email delivery. Each send (first send or resend) is a Delivery row,
// and the rows are the queue:
//
//   queue    → a QUEUED row per invite; a partial unique index allows only one
//              QUEUED/SENDING row per invite, so double clicks queue nothing new.
//   claim    → UPDATE … FOR UPDATE SKIP LOCKED sets SENDING with a fresh claimId
//              (and re-claims rows whose lease ran out after a crash).
//   send     → the link token is derived from the delivery ID, so a retry sends
//              the same link, never a competing one.
//   finish   → only if the row is still SENDING under our claimId. A cancel, or a
//              newer claim, makes the stale finish a no-op.
//
// Requests send right away; a scheduled worker (/api/jobs/run) drains the rest.
import { createHash, createHmac, randomBytes, randomUUID } from "crypto";
import { DeliveryState, InviteStatus } from "@prisma/client";
import { prisma } from "./db";
import { appUrl, sendEmailBatch, type BatchResult, type SendEmailParams } from "./email";
import { inviteEmail, inviteExpiry } from "./invites";

export const MAX_ATTEMPTS = 3;
/** A SENDING row whose worker vanished is retried after this long. */
export const LEASE_MS = 5 * 60_000;
const BACKOFF_MS = [60_000, 5 * 60_000];

type SendBatch = (messages: SendEmailParams[], opts: { idempotencyKey?: string }) => Promise<BatchResult[]>;

function linkSecret(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET is required to sign invite links");
  return s;
}

/** The link token for a delivery: stable across retries, unguessable without the secret. */
export function deliveryToken(deliveryId: string): string {
  return createHmac("sha256", linkSecret()).update(`invite-link:${deliveryId}`).digest("base64url");
}

export const tokenHashOf = (raw: string) => createHash("sha256").update(raw).digest("hex");

function newDelivery(inviteId: string) {
  const id = `dl_${randomBytes(12).toString("base64url")}`;
  // runAfter from the app clock, not the column default (see lib/jobs.ts enqueueJob).
  return { id, inviteId, tokenHash: tokenHashOf(deliveryToken(id)), runAfter: new Date() };
}

/** Queues one send per invite. Invites with a send already in flight are skipped. */
export async function queueDeliveries(inviteIds: string[]): Promise<number> {
  if (inviteIds.length === 0) return 0;
  const result = await prisma.delivery.createMany({ data: inviteIds.map(newDelivery), skipDuplicates: true });
  return result.count;
}

/** Queues every unsent invite in a campaign (and failed ones when retrying). */
export async function queueCampaign(campaignId: string, opts: { retryFailed?: boolean } = {}) {
  const statuses: InviteStatus[] = opts.retryFailed ? [InviteStatus.PENDING, InviteStatus.FAILED] : [InviteStatus.PENDING];
  const invites = await prisma.invite.findMany({ where: { campaignId, status: { in: statuses } }, select: { id: true } });
  return queueDeliveries(invites.map((i) => i.id));
}

interface Claimed {
  id: string;
  inviteId: string;
  tokenHash: string;
  attempts: number;
}

async function claim(claimId: string, limit: number, campaignId: string | null, inviteId: string | null): Promise<Claimed[]> {
  // The columns are UTC timestamps without a zone. Pass UTC strings cast to
  // timestamp: SQL now() or a Date parameter would be read in the session's zone.
  const at = new Date();
  const now = at.toISOString();
  const leaseCutoff = new Date(at.getTime() - LEASE_MS).toISOString();
  return prisma.$queryRaw<Claimed[]>`
    UPDATE "Delivery" d
    SET "state" = 'SENDING', "claimId" = ${claimId}, "claimedAt" = ${now}::timestamp, "attempts" = d."attempts" + 1, "updatedAt" = ${now}::timestamp
    WHERE d."id" IN (
      SELECT d2."id" FROM "Delivery" d2
      JOIN "Invite" i ON i."id" = d2."inviteId"
      WHERE ((d2."state" = 'QUEUED' AND d2."runAfter" <= ${now}::timestamp) OR (d2."state" = 'SENDING' AND d2."claimedAt" < ${leaseCutoff}::timestamp))
        AND i."status" <> 'REVOKED'
        AND (${campaignId}::text IS NULL OR i."campaignId" = ${campaignId})
        AND (${inviteId}::text IS NULL OR i."id" = ${inviteId})
      ORDER BY d2."createdAt"
      LIMIT ${limit}
      FOR UPDATE OF d2 SKIP LOCKED
    )
    RETURNING d."id", d."inviteId", d."tokenHash", d."attempts"`;
}

type SnapshotConfig = { config: { name: string; rounds: unknown[] }; totalMinutes: number };

/**
 * Claims up to `limit` queued sends and emails them. Safe to run from many
 * places at once: requests, the scheduled worker, two browser tabs.
 */
export async function processDeliveries(
  opts: { limit?: number; campaignId?: string; inviteId?: string; send?: SendBatch } = {},
): Promise<{ sent: number; failed: number; retrying: number }> {
  const send = opts.send ?? sendEmailBatch;
  const claimId = randomUUID();
  const rows = await claim(claimId, opts.limit ?? 50, opts.campaignId ?? null, opts.inviteId ?? null);
  if (rows.length === 0) return { sent: 0, failed: 0, retrying: 0 };

  const invites = await prisma.invite.findMany({
    where: { id: { in: rows.map((r) => r.inviteId) } },
    select: {
      id: true,
      email: true,
      name: true,
      campaign: {
        select: {
          deadline: true,
          message: true,
          loopVersion: true,
          organization: { select: { name: true, contactEmail: true } },
          loopTemplate: { select: { versions: { select: { version: true, snapshot: true } } } },
        },
      },
    },
  });
  const byId = new Map(invites.map((i) => [i.id, i]));
  const base = appUrl().replace(/\/$/, "");
  const now = new Date();

  const prepared = rows.flatMap((row) => {
    const inv = byId.get(row.inviteId);
    const snapshot = inv?.campaign.loopTemplate.versions.find((v) => v.version === inv.campaign.loopVersion)?.snapshot as SnapshotConfig | undefined;
    if (!inv || !snapshot) return [];
    const token = deliveryToken(row.id);
    const expiresAt = inviteExpiry(now, inv.campaign.deadline);
    return [{
      row,
      tokenHash: tokenHashOf(token),
      expiresAt,
      email: inviteEmail({
        to: inv.email,
        name: inv.name,
        loopName: snapshot.config.name,
        rounds: snapshot.config.rounds.length,
        minutes: snapshot.totalMinutes,
        message: inv.campaign.message,
        link: `${base}/i/${token}`,
        expiresAt,
        company: inv.campaign.organization?.name ?? null,
        replyTo: inv.campaign.organization?.contactEmail ?? null,
      }),
    }];
  });
  // A row we couldn't build an email for (its loop version vanished) fails outright.
  const unbuildable = rows.filter((r) => !prepared.some((p) => p.row.id === r.id));
  for (const r of unbuildable) await finishFailed(r, claimId, "This invite's loop version no longer exists.", true);

  let sent = 0;
  let failed = 0;
  let retrying = 0;
  for (let i = 0; i < prepared.length; i += 100) {
    const chunk = prepared.slice(i, i + 100);
    // Same claim, same chunk: Resend won't send it twice if we retry the request.
    const results = await send(chunk.map((p) => p.email), { idempotencyKey: `${claimId}:${i}` }).catch((e): BatchResult[] =>
      chunk.map(() => ({ ok: false, error: e instanceof Error ? e.message : "Email send failed" })),
    );
    for (const [j, p] of chunk.entries()) {
      const r = results[j] ?? { ok: false as const, error: "No result from the email provider" };
      if (r.ok) {
        if (await finishSent(p.row, claimId, p.tokenHash, p.expiresAt, r.messageId ?? null)) sent++;
      } else {
        const final = p.row.attempts >= MAX_ATTEMPTS;
        if (await finishFailed(p.row, claimId, r.error, final)) {
          if (final) failed++;
          else retrying++;
        }
      }
    }
  }
  return { sent, failed, retrying };
}

/** Marks the send done and makes its link the invite's live link, unless the invite was cancelled meanwhile. */
async function finishSent(row: Claimed, claimId: string, tokenHash: string, expiresAt: Date, messageId: string | null): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const done = await tx.delivery.updateMany({
      where: { id: row.id, state: DeliveryState.SENDING, claimId },
      data: { state: DeliveryState.SENT, sentAt: new Date(), providerMessageId: messageId, tokenHash, lastError: null },
    });
    if (done.count !== 1) return false;
    const fields = { tokenHash, sentAt: new Date(), expiresAt, sendCount: { increment: 1 }, lastError: null };
    // A resend never moves an opened, started or finished invite backwards.
    await tx.invite.updateMany({
      where: { id: row.inviteId, status: { in: [InviteStatus.PENDING, InviteStatus.FAILED, InviteStatus.SENT] } },
      data: { ...fields, status: InviteStatus.SENT },
    });
    await tx.invite.updateMany({
      where: { id: row.inviteId, status: { in: [InviteStatus.OPENED, InviteStatus.STARTED, InviteStatus.COMPLETED] } },
      data: fields,
    });
    return true;
  });
}

async function finishFailed(row: Claimed, claimId: string, error: string, final: boolean): Promise<boolean> {
  const lastError = error.slice(0, 300);
  return prisma.$transaction(async (tx) => {
    const done = await tx.delivery.updateMany({
      where: { id: row.id, state: DeliveryState.SENDING, claimId },
      data: final
        ? { state: DeliveryState.FAILED, lastError }
        : { state: DeliveryState.QUEUED, lastError, claimId: null, runAfter: new Date(Date.now() + BACKOFF_MS[Math.min(row.attempts - 1, BACKOFF_MS.length - 1)]!) },
    });
    if (done.count !== 1) return false;
    if (final) {
      // Only an invite that was never delivered is shown as failed; a failed resend keeps the earlier link.
      await tx.invite.updateMany({ where: { id: row.inviteId, status: { in: [InviteStatus.PENDING, InviteStatus.FAILED] } }, data: { status: InviteStatus.FAILED, lastError } });
      await tx.invite.updateMany({ where: { id: row.inviteId, status: { notIn: [InviteStatus.PENDING, InviteStatus.FAILED] } }, data: { lastError } });
    }
    return true;
  });
}

/** Queued plus in-flight sends, and invites not yet queued, for a campaign's progress bar. */
export async function remainingFor(campaignId: string) {
  const [active, unqueued] = await Promise.all([
    prisma.delivery.count({ where: { state: { in: [DeliveryState.QUEUED, DeliveryState.SENDING] }, invite: { campaignId } } }),
    prisma.invite.count({ where: { campaignId, status: InviteStatus.PENDING, deliveries: { none: { state: { in: [DeliveryState.QUEUED, DeliveryState.SENDING] } } } } }),
  ]);
  return active + unqueued;
}

/** Cancels an invite. In-flight sends are cancelled too; a send finishing later can't revive it. */
export async function cancelInvite(inviteId: string) {
  await prisma.$transaction([
    prisma.invite.update({ where: { id: inviteId }, data: { status: InviteStatus.REVOKED } }),
    prisma.delivery.updateMany({
      where: { inviteId, state: { in: [DeliveryState.QUEUED, DeliveryState.SENDING] } },
      data: { state: DeliveryState.CANCELLED, claimId: null },
    }),
  ]);
}

