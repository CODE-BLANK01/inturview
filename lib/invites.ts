import { createHash, randomBytes } from "crypto";
import { InviteStatus, Prisma } from "@prisma/client";
import { prisma } from "./db";
import { appUrl, sendEmailBatch, type SendEmailParams } from "./email";
import type { Recipient } from "./recipients";

export const DEFAULT_LINK_DAYS = 14;
export const SEND_BATCH = 50;

/** 32 random bytes for the link; only the hash is stored, like password resets. */
export function newInviteToken() {
  const raw = randomBytes(32).toString("base64url");
  return { raw, hash: hashInviteToken(raw) };
}
export const hashInviteToken = (raw: string) => createHash("sha256").update(raw).digest("hex");

export function inviteExpiry(sentAt: Date, deadline: Date | null): Date {
  const byDays = new Date(sentAt.getTime() + DEFAULT_LINK_DAYS * 86_400_000);
  return deadline && deadline < byDays ? deadline : byDays;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export interface InviteEmailInput {
  to: string;
  name: string | null;
  loopName: string;
  rounds: number;
  minutes: number;
  message: string | null;
  link: string;
  expiresAt: Date;
}

/** The invitation email. Pure; unit-tested. */
export function inviteEmail(i: InviteEmailInput): SendEmailParams {
  const first = i.name?.split(/\s+/)[0] ?? null;
  const when = i.expiresAt.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
  const length = `${i.rounds} round${i.rounds === 1 ? "" : "s"}, about ${i.minutes} minutes`;
  const text = [
    `Hi${first ? ` ${first}` : ""},`,
    "",
    `You're invited to an interview: ${i.loopName} (${length}).`,
    ...(i.message ? ["", i.message] : []),
    "",
    "It runs in your browser with an AI interviewer. You can start whenever suits you before the link expires.",
    "",
    i.link,
    "",
    `The link is personal to you and works until ${when}.`,
    "Need an adjustment, like more time or a different format? Reply to this email.",
    "",
    "— inturview",
  ].join("\n");
  const html = `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#FAF7F2;color:#1A1410;padding:32px;line-height:1.6">
  <p>Hi${first ? ` ${esc(first)}` : ""},</p>
  <p>You're invited to an interview: <strong>${esc(i.loopName)}</strong> (${esc(length)}).</p>
  ${i.message ? `<p style="border-left:3px solid #E8E2D9;padding-left:12px;color:#4A3F37">${esc(i.message).replace(/\n/g, "<br>")}</p>` : ""}
  <p>It runs in your browser with an AI interviewer. You can start whenever suits you before the link expires.</p>
  <p style="margin:24px 0"><a href="${esc(i.link)}" style="background:#1A1410;color:#FAF7F2;padding:12px 20px;text-decoration:none;border-radius:8px;font-weight:600;display:inline-block">Open your interview</a></p>
  <p style="font-size:13px;color:#6B5E54">The link is personal to you and works until ${esc(when)}.<br>Need an adjustment, like more time or a different format? Reply to this email.</p>
  <p style="font-size:13px;color:#6B5E54">— inturview</p>
</body></html>`;
  return { to: i.to, subject: `You're invited: ${i.loopName}`, text, html, replyTo: "hello@inturview.com" };
}

/** Adds candidates to a campaign as PENDING. Existing emails are skipped. */
export async function addRecipients(campaignId: string, recipients: Recipient[]) {
  const result = await prisma.invite.createMany({
    data: recipients.map((r) => ({ campaignId, email: r.email.toLowerCase(), name: r.name })),
    skipDuplicates: true,
  });
  return { added: result.count, skipped: recipients.length - result.count };
}

type CampaignForSend = Prisma.CampaignGetPayload<{ include: { loopTemplate: { select: { versions: { select: { version: true; snapshot: true } } } } } }>;

async function loadCampaignForSend(campaignId: string) {
  const campaign = await prisma.campaign.findUniqueOrThrow({
    where: { id: campaignId },
    include: { loopTemplate: { select: { versions: { select: { version: true, snapshot: true } } } } },
  });
  const snapshot = campaign.loopTemplate.versions.find((v) => v.version === campaign.loopVersion)?.snapshot as
    | { config: { name: string; rounds: unknown[] }; totalMinutes: number }
    | undefined;
  if (!snapshot) throw new Error("This campaign's loop version no longer exists.");
  return { campaign, snapshot };
}

/** Emails exactly these invites. Each gets a fresh token, so an old link stops working. */
async function sendInvites(
  { campaign, snapshot }: { campaign: CampaignForSend; snapshot: { config: { name: string; rounds: unknown[] }; totalMinutes: number } },
  invites: { id: string; email: string; name: string | null; status: InviteStatus }[],
) {
  const base = appUrl().replace(/\/$/, "");
  const now = new Date();
  const prepared = invites.map((inv) => {
    const token = newInviteToken();
    const expiresAt = inviteExpiry(now, campaign.deadline);
    return {
      inv,
      token,
      expiresAt,
      email: inviteEmail({
        to: inv.email,
        name: inv.name,
        loopName: snapshot.config.name,
        rounds: snapshot.config.rounds.length,
        minutes: snapshot.totalMinutes,
        message: campaign.message,
        link: `${base}/i/${token.raw}`,
        expiresAt,
      }),
    };
  });
  const results: Awaited<ReturnType<typeof sendEmailBatch>> = [];
  for (let i = 0; i < prepared.length; i += 100) {
    results.push(...(await sendEmailBatch(prepared.slice(i, i + 100).map((p) => p.email))));
  }
  let sent = 0;
  let failed = 0;
  await prisma.$transaction(
    prepared.map((p, i) => {
      const r = results[i]!;
      if (r.ok) sent++;
      else failed++;
      return prisma.invite.update({
        where: { id: p.inv.id },
        data: r.ok
          ? {
              // A resend never moves an opened or started invite backwards.
              status: p.inv.status === InviteStatus.OPENED || p.inv.status === InviteStatus.STARTED ? p.inv.status : InviteStatus.SENT,
              tokenHash: p.token.hash,
              sentAt: now,
              expiresAt: p.expiresAt,
              sendCount: { increment: 1 },
              lastError: null,
            }
          : { status: InviteStatus.FAILED, lastError: r.error.slice(0, 300) },
      });
    }),
  );
  return { sent, failed };
}

/**
 * Sends the next batch of PENDING invites (and FAILED ones when retrying).
 * The admin screen calls this until nothing remains, keeping each request
 * well inside serverless time limits.
 */
export async function sendNextBatch(campaignId: string, opts: { retryFailed?: boolean } = {}) {
  const loaded = await loadCampaignForSend(campaignId);
  const statuses: InviteStatus[] = opts.retryFailed ? [InviteStatus.PENDING, InviteStatus.FAILED] : [InviteStatus.PENDING];
  const batch = await prisma.invite.findMany({
    where: { campaignId, status: { in: statuses } },
    orderBy: { createdAt: "asc" },
    take: SEND_BATCH,
    select: { id: true, email: true, name: true, status: true },
  });
  const { sent, failed } = batch.length ? await sendInvites(loaded, batch) : { sent: 0, failed: 0 };
  const remaining = await prisma.invite.count({ where: { campaignId, status: { in: statuses } } });
  return { sent, failed, remaining };
}

/** Re-sends one invite now, with a new link. Finished and revoked invites can't be resent. */
export async function resendInvite(inviteId: string) {
  const inv = await prisma.invite.findUniqueOrThrow({ where: { id: inviteId }, select: { id: true, email: true, name: true, status: true, campaignId: true } });
  if (inv.status === InviteStatus.COMPLETED) throw new InviteActionError("This candidate already finished.");
  if (inv.status === InviteStatus.REVOKED) throw new InviteActionError("This invite was cancelled.");
  const { sent } = await sendInvites(await loadCampaignForSend(inv.campaignId), [inv]);
  return { sent: sent === 1 };
}

export class InviteActionError extends Error {}

/** Keeps the token hash so the link can say "cancelled" instead of "doesn't work". */
export async function revokeInvite(inviteId: string) {
  return prisma.invite.update({ where: { id: inviteId }, data: { status: InviteStatus.REVOKED } });
}

export type InviteLookup =
  | { ok: true; invite: Prisma.InviteGetPayload<{ include: { campaign: true } }> }
  | { ok: false; reason: "unknown" | "revoked" | "expired" };

/** Resolves a link token. Revoked and expired links say so plainly. */
export async function findInviteByToken(raw: string, now = new Date()): Promise<InviteLookup> {
  if (!raw || raw.length < 20 || raw.length > 100) return { ok: false, reason: "unknown" };
  const invite = await prisma.invite.findUnique({ where: { tokenHash: hashInviteToken(raw) }, include: { campaign: true } });
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
