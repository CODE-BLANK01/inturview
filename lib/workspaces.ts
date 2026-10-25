// Workspaces, memberships and teammate invitations (Hire).
// Next-free so the database tests can drive it directly; page and API guards
// live in lib/workspaceGuard.ts.
import { createHash, randomBytes } from "crypto";
import { OrgRole, Prisma, Role } from "@prisma/client";
import { prisma } from "./db";
import { appUrl, sendEmail, type SendEmailParams } from "./email";
import { can, canManageRole, ROLE_LABELS, type Permission } from "./permissions";
import { isValidSlug, slugify } from "./slug";
import { inlineColors } from "./theme";

export { isValidSlug, slugify };

export const MEMBER_INVITE_DAYS = 7;
export const SUPPORT_GRANT_MAX_HOURS = 24;
export class WorkspaceError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export const normalizeEmail = (e: string) => e.trim().toLowerCase();

/** `base`, or `base-2`, `base-3`… whichever is free. */
export async function availableSlug(base: string): Promise<string> {
  const root = isValidSlug(base) ? base : `${base || "workspace"}-co`.slice(0, 40);
  for (let n = 1; n < 50; n++) {
    const candidate = n === 1 ? root : `${root.slice(0, 36)}-${n}`;
    if (!(await prisma.organization.findUnique({ where: { slug: candidate }, select: { id: true } }))) return candidate;
  }
  return `${root.slice(0, 30)}-${randomBytes(3).toString("hex")}`;
}

// ── Access ──────────────────────────────────────────────────────────────────

export interface WorkspaceOrg {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  website: string | null;
  logoUrl: string | null;
  contactEmail: string | null;
  designPartner: boolean;
  retentionMonths: number;
}

export type WorkspaceAccess = {
  org: WorkspaceOrg;
  userId: string;
  /** Null when the viewer is an operator on a support grant. */
  role: OrgRole | null;
  support: { grantId: string; expiresAt: Date; reason: string } | null;
};

const ORG_SELECT = {
  id: true,
  name: true,
  slug: true,
  timezone: true,
  website: true,
  logoUrl: true,
  contactEmail: true,
  designPartner: true,
  retentionMonths: true,
} satisfies Prisma.OrganizationSelect;

/** Support access is read-only: it shows what the company sees, nothing more. */
const SUPPORT_PERMISSIONS = new Set<Permission>(["workspace.view", "applications.viewAll"]);

export function accessAllows(access: WorkspaceAccess, permission: Permission): boolean {
  if (access.role) return can(access.role, permission);
  return access.support ? SUPPORT_PERMISSIONS.has(permission) : false;
}

/**
 * The one place workspace access is decided. Membership comes only from an
 * OrganizationMember row; platform operators get in only through an active
 * SupportAccessGrant. Returns null for "no such workspace" and "not yours"
 * alike, so callers can't tell the two apart.
 */
export async function resolveWorkspaceAccess(
  slug: string,
  user: { id: string; role: Role },
  now = new Date(),
): Promise<WorkspaceAccess | null> {
  if (!isValidSlug(slug)) return null;
  const org = await prisma.organization.findUnique({
    where: { slug },
    select: {
      ...ORG_SELECT,
      members: { where: { userId: user.id }, select: { role: true } },
      supportGrants:
        user.role === Role.ADMIN
          ? {
              where: { operatorId: user.id, endedAt: null, expiresAt: { gt: now } },
              orderBy: { expiresAt: "desc" },
              take: 1,
              select: { id: true, expiresAt: true, reason: true },
            }
          : false,
    },
  });
  if (!org) return null;
  const { members, supportGrants, ...rest } = org;
  const role = members[0]?.role ?? null;
  const grant = supportGrants?.[0];
  if (!role && !grant) return null;
  return {
    org: rest,
    userId: user.id,
    role,
    support: !role && grant ? { grantId: grant.id, expiresAt: grant.expiresAt, reason: grant.reason } : null,
  };
}

/** Workspaces the user belongs to, for the /hire picker. */
export function listMyWorkspaces(userId: string) {
  return prisma.organizationMember.findMany({
    where: { userId },
    orderBy: { organization: { name: "asc" } },
    select: { role: true, organization: { select: { name: true, slug: true } } },
  });
}

// ── Teammate invitations ────────────────────────────────────────────────────

const hashToken = (raw: string) => createHash("sha256").update(raw).digest("hex");

export function memberInviteLink(raw: string) {
  return `${appUrl()}/hire/join/${raw}`;
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Pure; unit-tested. */
export function memberInviteEmail(i: {
  to: string;
  orgName: string;
  role: OrgRole;
  inviterName: string | null;
  link: string;
  expiresAt: Date;
}): SendEmailParams {
  const who = i.inviterName ? `${i.inviterName} invited you` : "You're invited";
  const role = ROLE_LABELS[i.role].toLowerCase();
  const when = i.expiresAt.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
  const text = [
    `${who} to join ${i.orgName} on inturview Hire as ${/^[aeiou]/.test(role) ? "an" : "a"} ${role}.`,
    "",
    i.link,
    "",
    `Sign in or create an account with ${i.to} to accept. The link works until ${when}.`,
    "If you weren't expecting this, you can ignore it.",
    "",
    "— inturview",
  ].join("\n");
  const html = `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:${inlineColors.page};color:${inlineColors.text};padding:32px;line-height:1.6">
  <p>${esc(who)} to join <strong>${esc(i.orgName)}</strong> on inturview Hire as ${/^[aeiou]/.test(role) ? "an" : "a"} ${esc(role)}.</p>
  <p style="margin:24px 0"><a href="${esc(i.link)}" style="background:${inlineColors.button};color:${inlineColors.buttonText};padding:12px 20px;text-decoration:none;border-radius:8px;font-weight:600;display:inline-block">Accept invitation</a></p>
  <p style="font-size:13px;color:${inlineColors.muted}">Sign in or create an account with <strong>${esc(i.to)}</strong> to accept. The link works until ${esc(when)}.</p>
  <p style="font-size:13px;color:${inlineColors.muted}">If you weren't expecting this, you can ignore it.</p>
  <p style="font-size:13px;color:${inlineColors.muted}">— inturview</p>
</body></html>`;
  return { to: i.to, subject: `Join ${i.orgName} on inturview`, text, html };
}

/**
 * Invites `email` to the workspace. `actorRole` null means a platform operator
 * (only used when creating a design-partner workspace). Any earlier pending
 * invitation for the same email is revoked so only the newest link works.
 */
export async function inviteMember(opts: {
  organizationId: string;
  email: string;
  role: OrgRole;
  invitedById: string;
  actorRole: OrgRole | null;
  now?: Date;
}): Promise<{ invitationId: string; link: string; emailed: boolean; emailError?: string }> {
  const email = normalizeEmail(opts.email);
  const now = opts.now ?? new Date();
  if (opts.actorRole && !canManageRole(opts.actorRole, opts.role)) {
    throw new WorkspaceError(`Only an owner can invite ${ROLE_LABELS[opts.role].toLowerCase()}s.`, 403);
  }
  const org = await prisma.organization.findUnique({ where: { id: opts.organizationId }, select: { name: true } });
  if (!org) throw new WorkspaceError("Workspace not found", 404);
  const existing = await prisma.organizationMember.findFirst({
    where: { organizationId: opts.organizationId, user: { email } },
    select: { id: true },
  });
  if (existing) throw new WorkspaceError(`${email} is already in this workspace.`, 409);

  const raw = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + MEMBER_INVITE_DAYS * 86_400_000);
  const [, invitation, inviter] = await prisma.$transaction([
    prisma.memberInvitation.updateMany({
      where: { organizationId: opts.organizationId, email, acceptedAt: null, revokedAt: null },
      data: { revokedAt: now },
    }),
    prisma.memberInvitation.create({
      data: { organizationId: opts.organizationId, email, role: opts.role, tokenHash: hashToken(raw), invitedById: opts.invitedById, expiresAt },
      select: { id: true },
    }),
    prisma.user.findUnique({ where: { id: opts.invitedById }, select: { name: true } }),
  ]);

  const link = memberInviteLink(raw);
  const sent = await sendEmail(
    memberInviteEmail({
      to: email,
      orgName: org.name,
      role: opts.role,
      // Operators set up design-partner workspaces; don't put their name on it.
      inviterName: opts.actorRole ? inviter?.name ?? null : null,
      link,
      expiresAt,
    }),
  );
  return { invitationId: invitation.id, link, emailed: sent.ok, emailError: sent.ok ? undefined : sent.error };
}

export type MemberInvitationLookup =
  | {
      state: "valid" | "expired" | "revoked" | "accepted";
      invitation: { id: string; email: string; role: OrgRole; expiresAt: Date; organization: { name: string; slug: string } };
    }
  | { state: "unknown" };

export async function findMemberInvitation(raw: string, now = new Date()): Promise<MemberInvitationLookup> {
  if (!raw || raw.length > 100) return { state: "unknown" };
  const inv = await prisma.memberInvitation.findUnique({
    where: { tokenHash: hashToken(raw) },
    select: {
      id: true,
      email: true,
      role: true,
      expiresAt: true,
      acceptedAt: true,
      revokedAt: true,
      organization: { select: { name: true, slug: true } },
    },
  });
  if (!inv) return { state: "unknown" };
  const { acceptedAt, revokedAt, ...invitation } = inv;
  const state = acceptedAt ? "accepted" : revokedAt ? "revoked" : inv.expiresAt <= now ? "expired" : "valid";
  return { state, invitation };
}

/**
 * Accepts an invitation for the signed-in user. The account's email must be
 * verified and must equal the invited address exactly — a matching domain
 * grants nothing. Safe to call twice (the second call reports "accepted").
 */
export async function acceptMemberInvitation(
  raw: string,
  user: { id: string; email: string; emailVerified: boolean },
  now = new Date(),
): Promise<{ slug: string; organizationId: string }> {
  const found = await findMemberInvitation(raw, now);
  if (found.state === "unknown") throw new WorkspaceError("This invitation link isn't valid.", 404);
  const { invitation } = found;
  if (found.state === "accepted") {
    const member = await prisma.organizationMember.findFirst({
      where: { userId: user.id, organization: { slug: invitation.organization.slug } },
      select: { organizationId: true },
    });
    if (member) return { slug: invitation.organization.slug, organizationId: member.organizationId };
    throw new WorkspaceError("This invitation has already been used.", 410);
  }
  if (found.state === "revoked") throw new WorkspaceError("This invitation was withdrawn. Ask for a new one.", 410);
  if (found.state === "expired") throw new WorkspaceError("This invitation has expired. Ask for a new one.", 410);
  if (normalizeEmail(user.email) !== invitation.email) {
    throw new WorkspaceError(`This invitation is for ${invitation.email}. Sign in with that email to accept it.`, 403);
  }
  if (!user.emailVerified) throw new WorkspaceError("Verify your email first.", 403);

  const organizationId = await prisma.$transaction(async (tx) => {
    const claimed = await tx.memberInvitation.updateMany({
      where: { id: invitation.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: now } },
      data: { acceptedAt: now, acceptedById: user.id },
    });
    if (claimed.count !== 1) throw new WorkspaceError("This invitation has already been used.", 410);
    const org = await tx.organization.findUniqueOrThrow({ where: { slug: invitation.organization.slug }, select: { id: true } });
    // Someone already in the workspace keeps their current role.
    await tx.organizationMember.upsert({
      where: { organizationId_userId: { organizationId: org.id, userId: user.id } },
      create: { organizationId: org.id, userId: user.id, role: invitation.role },
      update: {},
    });
    return org.id;
  });
  return { slug: invitation.organization.slug, organizationId };
}

export async function revokeMemberInvitation(organizationId: string, invitationId: string, actorRole: OrgRole, now = new Date()) {
  const inv = await prisma.memberInvitation.findFirst({
    where: { id: invitationId, organizationId },
    select: { role: true, acceptedAt: true, revokedAt: true },
  });
  if (!inv) throw new WorkspaceError("Invitation not found", 404);
  if (!canManageRole(actorRole, inv.role)) throw new WorkspaceError("You can't withdraw this invitation.", 403);
  if (inv.acceptedAt) throw new WorkspaceError("Already accepted.", 409);
  if (!inv.revokedAt) await prisma.memberInvitation.update({ where: { id: invitationId }, data: { revokedAt: now } });
}

// ── Members ─────────────────────────────────────────────────────────────────

async function ownerCount(tx: Prisma.TransactionClient, organizationId: string) {
  return tx.organizationMember.count({ where: { organizationId, role: OrgRole.OWNER } });
}

/** Changes a teammate's role. A workspace always keeps at least one owner. */
export async function changeMemberRole(opts: {
  organizationId: string;
  memberId: string;
  role: OrgRole;
  actorRole: OrgRole;
}) {
  await prisma.$transaction(async (tx) => {
    const member = await tx.organizationMember.findFirst({
      where: { id: opts.memberId, organizationId: opts.organizationId },
      select: { role: true },
    });
    if (!member) throw new WorkspaceError("Teammate not found", 404);
    if (!canManageRole(opts.actorRole, member.role) || !canManageRole(opts.actorRole, opts.role)) {
      throw new WorkspaceError("You can't change this teammate's role.", 403);
    }
    if (member.role === OrgRole.OWNER && opts.role !== OrgRole.OWNER && (await ownerCount(tx, opts.organizationId)) <= 1) {
      throw new WorkspaceError("Make someone else an owner first.", 409);
    }
    await tx.organizationMember.update({ where: { id: opts.memberId }, data: { role: opts.role } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function removeMember(opts: { organizationId: string; memberId: string; actorRole: OrgRole; actorUserId: string }) {
  await prisma.$transaction(async (tx) => {
    const member = await tx.organizationMember.findFirst({
      where: { id: opts.memberId, organizationId: opts.organizationId },
      select: { role: true, userId: true },
    });
    if (!member) throw new WorkspaceError("Teammate not found", 404);
    // Anyone may leave; removing others follows the matrix.
    if (member.userId !== opts.actorUserId && !canManageRole(opts.actorRole, member.role)) {
      throw new WorkspaceError("You can't remove this teammate.", 403);
    }
    if (member.role === OrgRole.OWNER && (await ownerCount(tx, opts.organizationId)) <= 1) {
      throw new WorkspaceError("A workspace needs an owner. Make someone else an owner first.", 409);
    }
    await tx.organizationMember.delete({ where: { id: opts.memberId } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

// ── Operator ────────────────────────────────────────────────────────────────

/** D1: design-partner workspaces are created by an operator, with an owner invitation. */
export async function createDesignPartnerWorkspace(opts: {
  name: string;
  slug?: string;
  ownerEmail: string;
  timezone?: string;
  operatorId: string;
}) {
  const slug = opts.slug ? opts.slug : await availableSlug(slugify(opts.name));
  if (!isValidSlug(slug)) throw new WorkspaceError("Use lowercase letters, numbers and dashes for the address.");
  let org: { id: string; slug: string };
  try {
    org = await prisma.organization.create({
      data: { name: opts.name.trim(), slug, timezone: opts.timezone ?? "UTC", designPartner: true, contactEmail: normalizeEmail(opts.ownerEmail) },
      select: { id: true, slug: true },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new WorkspaceError(`hire/${slug} is taken. Pick another address.`, 409);
    }
    throw e;
  }
  const invite = await inviteMember({
    organizationId: org.id,
    email: opts.ownerEmail,
    role: OrgRole.OWNER,
    invitedById: opts.operatorId,
    actorRole: null,
  });
  return { org, invite };
}

/** Time-boxed, reasoned support access for an operator. */
export async function grantSupportAccess(opts: { organizationId: string; operatorId: string; reason: string; hours: number; now?: Date }) {
  const reason = opts.reason.trim();
  if (reason.length < 10) throw new WorkspaceError("Write down why you need access (at least 10 characters).");
  const hours = Math.min(Math.max(1, Math.round(opts.hours)), SUPPORT_GRANT_MAX_HOURS);
  const now = opts.now ?? new Date();
  return prisma.supportAccessGrant.create({
    data: { organizationId: opts.organizationId, operatorId: opts.operatorId, reason, expiresAt: new Date(now.getTime() + hours * 3_600_000) },
    select: { id: true, expiresAt: true },
  });
}

export async function endSupportAccess(organizationId: string, operatorId: string, now = new Date()) {
  await prisma.supportAccessGrant.updateMany({
    where: { organizationId, operatorId, endedAt: null, expiresAt: { gt: now } },
    data: { endedAt: now },
  });
}

/** Turns a WorkspaceError into its JSON response; rethrows anything else. */
export function workspaceErrorResponse(e: unknown): Response {
  if (e instanceof WorkspaceError) return Response.json({ error: e.message }, { status: e.status });
  throw e;
}

/** Workspaces where `userId` is the only owner. Deleting that account would leave the company without one. */
export async function soleOwnerOf(userId: string): Promise<string[]> {
  const owned = await prisma.organizationMember.findMany({
    where: { userId, role: OrgRole.OWNER },
    select: { organization: { select: { name: true, _count: { select: { members: { where: { role: OrgRole.OWNER } } } } } } },
  });
  return owned.filter((m) => m.organization._count.members <= 1).map((m) => m.organization.name);
}
