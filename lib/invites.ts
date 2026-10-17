import { createHash, randomBytes } from "crypto";
import { InviteStatus, Prisma } from "@prisma/client";
import { prisma } from "./db";
import { cancelInvite, processDeliveries, queueDeliveries } from "./delivery";
import type { Recipient } from "./recipients";


/** 32 random bytes for the link; only the hash is stored, like password resets. */
export function newInviteToken() {
  const raw = randomBytes(32).toString("base64url");
  return { raw, hash: hashInviteToken(raw) };
}
export const hashInviteToken = (raw: string) => createHash("sha256").update(raw).digest("hex");

export { DEFAULT_LINK_DAYS, inviteEmail, inviteExpiry, type InviteEmailInput } from "./inviteEmail";

/** Adds candidates to a campaign as PENDING. Existing emails are skipped. */
export async function addRecipients(campaignId: string, recipients: Recipient[]) {
  const result = await prisma.invite.createMany({
    data: recipients.map((r) => ({ campaignId, email: r.email.toLowerCase(), name: r.name })),
    skipDuplicates: true,
  });
  return { added: result.count, skipped: recipients.length - result.count };
}

export class InviteActionError extends Error {}

/** Re-sends one invite now with a new link; the old link stops working once it's delivered. */
export async function resendInvite(inviteId: string): Promise<{ sent: boolean; error?: string }> {
  const inv = await prisma.invite.findUniqueOrThrow({ where: { id: inviteId }, select: { status: true } });
  if (inv.status === InviteStatus.COMPLETED) throw new InviteActionError("This candidate already finished.");
  if (inv.status === InviteStatus.REVOKED) throw new InviteActionError("This invite was cancelled.");
  const queued = await queueDeliveries([inviteId]);
  if (queued === 0) throw new InviteActionError("A send for this invite is already in progress. Give it a minute.");
  const r = await processDeliveries({ inviteId, limit: 1 });
  if (r.sent === 1) return { sent: true };
  const last = await prisma.delivery.findFirst({ where: { inviteId }, orderBy: { createdAt: "desc" }, select: { lastError: true, state: true } });
  return { sent: false, error: last?.state === "QUEUED" ? "The email provider didn't accept it yet; we'll retry automatically." : last?.lastError ?? undefined };
}

/** Keeps the token hash so the link can say "cancelled" instead of "doesn't work". */
export const revokeInvite = cancelInvite;

/** What an applicant may see about the hiring company. */
const APPLICANT_ORG = { select: { name: true, slug: true, timezone: true, contactEmail: true, logoUrl: true, website: true } } as const;

export type InviteLookup =
  | { ok: true; invite: Prisma.InviteGetPayload<{ include: { campaign: { include: { organization: typeof APPLICANT_ORG } } } }> }
  | { ok: false; reason: "unknown" | "revoked" | "expired" };

/** Resolves a link token. Revoked and expired links say so plainly. */
export async function findInviteByToken(raw: string, now = new Date()): Promise<InviteLookup> {
  if (!raw || raw.length < 20 || raw.length > 100) return { ok: false, reason: "unknown" };
  const invite = await prisma.invite.findUnique({
    where: { tokenHash: hashInviteToken(raw) },
    include: { campaign: { include: { organization: APPLICANT_ORG } } },
  });
  if (!invite) return { ok: false, reason: "unknown" };
  if (invite.status === InviteStatus.REVOKED) return { ok: false, reason: "revoked" };
  if (invite.status !== InviteStatus.COMPLETED && invite.expiresAt && invite.expiresAt < now) return { ok: false, reason: "expired" };
  return { ok: true, invite };
}

/** First open moves SENT → OPENED; later states are never moved backwards. */
export async function markOpened(inviteId: string) {
  await prisma.invite.updateMany({
    where: { id: inviteId, status: InviteStatus.SENT },
    data: { status: InviteStatus.OPENED, openedAt: new Date() },
  });
}

export async function recordConsent(inviteId: string) {
  await prisma.invite.updateMany({ where: { id: inviteId, consentedAt: null }, data: { consentedAt: new Date() } });
}
