import "./setup";
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { randomBytes } from "node:crypto";
import { OrgRole, Role } from "@prisma/client";
import { prisma } from "../../lib/db";
import {
  acceptMemberInvitation,
  changeMemberRole,
  createDesignPartnerWorkspace,
  grantSupportAccess,
  inviteMember,
  removeMember,
  resolveWorkspaceAccess,
  revokeMemberInvitation,
  accessAllows,
  soleOwnerOf,
  WorkspaceError,
} from "../../lib/workspaces";
import { writeAudit } from "../../lib/audit";

const run = randomBytes(4).toString("hex");
const email = (who: string) => `${who}-${run}@example.test`;
const tokenOf = (link: string) => link.split("/hire/join/")[1];

async function makeUser(who: string, opts: { verified?: boolean; role?: Role } = {}) {
  return prisma.user.create({
    data: {
      email: email(who),
      passwordHash: "x",
      role: opts.role ?? Role.USER,
      emailVerifiedAt: opts.verified === false ? null : new Date(),
    },
    select: { id: true, email: true, role: true },
  });
}
const asAcceptor = (u: { id: string; email: string }, verified = true) => ({ id: u.id, email: u.email, emailVerified: verified });

async function rejects(p: Promise<unknown>, status: number) {
  await assert.rejects(p, (e: unknown) => e instanceof WorkspaceError && e.status === status);
}

let operator: Awaited<ReturnType<typeof makeUser>>;
const orgs: Record<"a" | "b", { id: string; slug: string; ownerId: string }> = {} as never;

before(async () => {
  operator = await makeUser("operator", { role: Role.ADMIN });
  for (const k of ["a", "b"] as const) {
    const owner = await makeUser(`owner-${k}`);
    const { org, invite } = await createDesignPartnerWorkspace({ name: `Co ${k.toUpperCase()} ${run}`, ownerEmail: owner.email, operatorId: operator.id });
    await acceptMemberInvitation(tokenOf(invite.link), asAcceptor(owner));
    orgs[k] = { ...org, ownerId: owner.id };
  }
});

after(async () => {
  await prisma.auditLog.deleteMany({ where: { targetId: { in: [orgs.a?.id, orgs.b?.id].filter(Boolean) } } });
  await prisma.organization.deleteMany({ where: { id: { in: [orgs.a?.id, orgs.b?.id].filter(Boolean) } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: `-${run}@example.test` } } });
  await prisma.$disconnect();
});

describe("isolation between companies", () => {
  test("a member of A gets nothing for B, same as a workspace that doesn't exist", async () => {
    const ownerA = { id: orgs.a.ownerId, role: Role.USER };
    assert.equal((await resolveWorkspaceAccess(orgs.a.slug, ownerA))?.role, OrgRole.OWNER);
    assert.equal(await resolveWorkspaceAccess(orgs.b.slug, ownerA), null);
    assert.equal(await resolveWorkspaceAccess(`missing-${run}`, ownerA), null);
  });

  test("A can't touch B's members or invitations by ID", async () => {
    const memberB = await prisma.organizationMember.findFirstOrThrow({ where: { organizationId: orgs.b.id } });
    const inviteB = await inviteMember({ organizationId: orgs.b.id, email: email("cand-b"), role: OrgRole.RECRUITER, invitedById: orgs.b.ownerId, actorRole: OrgRole.OWNER });
    await rejects(changeMemberRole({ organizationId: orgs.a.id, memberId: memberB.id, role: OrgRole.REVIEWER, actorRole: OrgRole.OWNER }), 404);
    await rejects(removeMember({ organizationId: orgs.a.id, memberId: memberB.id, actorRole: OrgRole.OWNER, actorUserId: orgs.a.ownerId }), 404);
    await rejects(revokeMemberInvitation(orgs.a.id, inviteB.invitationId, OrgRole.OWNER), 404);
    // B's data is untouched.
    assert.equal((await prisma.organizationMember.findUniqueOrThrow({ where: { id: memberB.id } })).role, OrgRole.OWNER);
    assert.equal((await prisma.memberInvitation.findUniqueOrThrow({ where: { id: inviteB.invitationId } })).revokedAt, null);
  });

  test("platform admins have no implicit access", async () => {
    assert.equal(await resolveWorkspaceAccess(orgs.a.slug, operator), null);
  });
});

describe("accepting an invitation", () => {
  test("only the exact invited email can accept; a matching domain grants nothing", async () => {
    const { link } = await inviteMember({ organizationId: orgs.a.id, email: email("recruiter"), role: OrgRole.RECRUITER, invitedById: orgs.a.ownerId, actorRole: OrgRole.OWNER });
    const sameDomain = await makeUser("someone-else");
    await rejects(acceptMemberInvitation(tokenOf(link), asAcceptor(sameDomain)), 403);
    assert.equal(await resolveWorkspaceAccess(orgs.a.slug, { id: sameDomain.id, role: Role.USER }), null);
  });

  test("the invitee must have verified their email", async () => {
    const unverified = await makeUser("unverified", { verified: false });
    const { link } = await inviteMember({ organizationId: orgs.a.id, email: unverified.email, role: OrgRole.REVIEWER, invitedById: orgs.a.ownerId, actorRole: OrgRole.OWNER });
    await rejects(acceptMemberInvitation(tokenOf(link), asAcceptor(unverified, false)), 403);
  });

  test("email case doesn't matter", async () => {
    const u = await makeUser("casey");
    const { link } = await inviteMember({ organizationId: orgs.a.id, email: u.email.toUpperCase(), role: OrgRole.REVIEWER, invitedById: orgs.a.ownerId, actorRole: OrgRole.OWNER });
    assert.equal((await acceptMemberInvitation(tokenOf(link), asAcceptor(u))).slug, orgs.a.slug);
  });

  test("two accepts at once make one membership", async () => {
    const u = await makeUser("double");
    const { link } = await inviteMember({ organizationId: orgs.a.id, email: u.email, role: OrgRole.RECRUITER, invitedById: orgs.a.ownerId, actorRole: OrgRole.OWNER });
    const results = await Promise.allSettled([acceptMemberInvitation(tokenOf(link), asAcceptor(u)), acceptMemberInvitation(tokenOf(link), asAcceptor(u))]);
    assert.ok(results.some((r) => r.status === "fulfilled"));
    assert.equal(await prisma.organizationMember.count({ where: { organizationId: orgs.a.id, userId: u.id } }), 1);
    // Opening the link again afterwards lands them in the workspace.
    assert.equal((await acceptMemberInvitation(tokenOf(link), asAcceptor(u))).slug, orgs.a.slug);
  });

  test("re-inviting withdraws the earlier link; expired links don't work", async () => {
    const u = await makeUser("reinvite");
    const first = await inviteMember({ organizationId: orgs.a.id, email: u.email, role: OrgRole.RECRUITER, invitedById: orgs.a.ownerId, actorRole: OrgRole.OWNER });
    const second = await inviteMember({ organizationId: orgs.a.id, email: u.email, role: OrgRole.RECRUITER, invitedById: orgs.a.ownerId, actorRole: OrgRole.OWNER });
    await rejects(acceptMemberInvitation(tokenOf(first.link), asAcceptor(u)), 410);
    const later = new Date(Date.now() + 8 * 86_400_000);
    await rejects(acceptMemberInvitation(tokenOf(second.link), asAcceptor(u), later), 410);
    await acceptMemberInvitation(tokenOf(second.link), asAcceptor(u));
  });

  test("already a member: inviting again is refused", async () => {
    const owner = await prisma.user.findUniqueOrThrow({ where: { id: orgs.a.ownerId } });
    await rejects(inviteMember({ organizationId: orgs.a.id, email: owner.email, role: OrgRole.RECRUITER, invitedById: orgs.a.ownerId, actorRole: OrgRole.OWNER }), 409);
  });
});

describe("roles", () => {
  test("recruiters can't invite; admins can't invite owners or admins", async () => {
    await rejects(inviteMember({ organizationId: orgs.a.id, email: email("x1"), role: OrgRole.REVIEWER, invitedById: orgs.a.ownerId, actorRole: OrgRole.RECRUITER }), 403);
    await rejects(inviteMember({ organizationId: orgs.a.id, email: email("x2"), role: OrgRole.ADMIN, invitedById: orgs.a.ownerId, actorRole: OrgRole.ADMIN }), 403);
    await rejects(inviteMember({ organizationId: orgs.a.id, email: email("x3"), role: OrgRole.OWNER, invitedById: orgs.a.ownerId, actorRole: OrgRole.ADMIN }), 403);
    await inviteMember({ organizationId: orgs.a.id, email: email("x4"), role: OrgRole.REVIEWER, invitedById: orgs.a.ownerId, actorRole: OrgRole.ADMIN });
  });

  test("a workspace always keeps an owner", async () => {
    const ownerMember = await prisma.organizationMember.findFirstOrThrow({ where: { organizationId: orgs.b.id, role: OrgRole.OWNER } });
    await rejects(changeMemberRole({ organizationId: orgs.b.id, memberId: ownerMember.id, role: OrgRole.ADMIN, actorRole: OrgRole.OWNER }), 409);
    await rejects(removeMember({ organizationId: orgs.b.id, memberId: ownerMember.id, actorRole: OrgRole.OWNER, actorUserId: orgs.b.ownerId }), 409);
  });

  test("an admin can't demote or remove an owner", async () => {
    const ownerMember = await prisma.organizationMember.findFirstOrThrow({ where: { organizationId: orgs.a.id, role: OrgRole.OWNER } });
    await rejects(changeMemberRole({ organizationId: orgs.a.id, memberId: ownerMember.id, role: OrgRole.RECRUITER, actorRole: OrgRole.ADMIN }), 403);
    await rejects(removeMember({ organizationId: orgs.a.id, memberId: ownerMember.id, actorRole: OrgRole.ADMIN, actorUserId: "someone" }), 403);
  });
});

describe("support access", () => {
  test("a grant is read-only, time-boxed, and only for platform admins", async () => {
    await grantSupportAccess({ organizationId: orgs.b.id, operatorId: operator.id, reason: "Checking a missing invitation email", hours: 1 });
    const access = await resolveWorkspaceAccess(orgs.b.slug, operator);
    assert.ok(access?.support);
    assert.equal(access.role, null);
    assert.equal(accessAllows(access, "workspace.view"), true);
    assert.equal(accessAllows(access, "members.manageStaff"), false);
    assert.equal(accessAllows(access, "workspace.editProfile"), false);
    assert.equal(await resolveWorkspaceAccess(orgs.b.slug, operator, new Date(Date.now() + 2 * 3_600_000)), null);
    // Demoted operators lose it even with a live grant row.
    assert.equal(await resolveWorkspaceAccess(orgs.b.slug, { id: operator.id, role: Role.USER }), null);
  });

  test("a reason is required", async () => {
    await rejects(grantSupportAccess({ organizationId: orgs.a.id, operatorId: operator.id, reason: "because", hours: 1 }), 400);
  });
});

describe("deleting accounts", () => {
  test("the only owner is flagged before deletion; a co-owner clears it", async () => {
    assert.deepEqual(await soleOwnerOf(orgs.b.ownerId), [`Co B ${run}`]);
    const co = await makeUser("co-owner");
    await prisma.organizationMember.create({ data: { organizationId: orgs.b.id, userId: co.id, role: OrgRole.OWNER } });
    assert.deepEqual(await soleOwnerOf(orgs.b.ownerId), []);
  });

  test("audit entries survive the actor's account being deleted", async () => {
    const u = await makeUser("leaver");
    await writeAudit({ adminId: u.id, action: "ORG_UPDATED", targetType: "organization", targetId: orgs.a.id });
    await prisma.user.delete({ where: { id: u.id } });
    const entry = await prisma.auditLog.findFirst({ where: { targetId: orgs.a.id, action: "ORG_UPDATED" }, orderBy: { createdAt: "desc" } });
    assert.ok(entry);
    assert.equal(entry.adminId, null);
  });
});
