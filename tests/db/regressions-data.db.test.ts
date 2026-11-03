// Regression tests for the October 15 review: C01, C04, C05, R07, R10.
import "./setup";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import { prisma } from "../../lib/db";
import * as h from "../../lib/hiring/handlers";
import { addNoteHandler, deleteApplicantHandler, exportApplicantHandler } from "../../lib/hiring/reviews";
import { listCandidates } from "../../lib/hiring/candidates";
import { addMonths, purgeExpiredApplicants } from "../../lib/applicantData";
import { findInviteByToken, newInviteToken } from "../../lib/invites";
import { defaultDestination } from "../../lib/landing";

const run = randomBytes(4).toString("hex");
const req = (body: unknown) => new NextRequest("http://test.local/api", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
let orgId = "", loopId = "", campaignId = "", actor = "";
const ctx = (): h.HiringCtx => ({ organizationId: orgId, actorId: actor, canViewAll: true });

async function candidate(data: Record<string, unknown> = {}, campaign = campaignId) {
  const t = newInviteToken();
  const inv = await prisma.invite.create({ data: { campaignId: campaign, email: `p-${randomBytes(4).toString("hex")}@example.test`, name: "Pat", tokenHash: t.hash, status: "COMPLETED", ...data } });
  const lr = await prisma.loopRun.create({ data: { inviteId: inv.id, loopTemplateId: loopId, loopVersion: 1 } });
  const rr = await prisma.loopRoundRun.create({ data: { runId: lr.id, roundIndex: 0, roundId: "r1", category: "BEHAVIORAL", questions: [] } });
  await prisma.loopMessage.create({ data: { roundRunId: rr.id, role: "candidate", content: "Something personal about me." } });
  await prisma.review.create({ data: { inviteId: inv.id, authorId: actor, kind: "NOTE", body: "A note about Pat." } });
  return { id: inv.id, token: t.raw };
}

before(async () => {
  actor = (await prisma.user.create({ data: { email: `d-${run}@example.test`, passwordHash: "x" } })).id;
  orgId = (await prisma.organization.create({ data: { name: `Co ${run}`, slug: `dt-${run}` } })).id;
  await prisma.organizationMember.create({ data: { organizationId: orgId, userId: actor, role: "OWNER" } });
  const loop = await prisma.loopTemplate.create({ data: { name: "L", organizationId: orgId, status: "PUBLISHED", currentVersion: 1 } });
  loopId = loop.id;
  await prisma.loopTemplateVersion.create({ data: { loopTemplateId: loop.id, version: 1, snapshot: { config: { name: "L", rounds: [] }, totalMinutes: 0 } } });
  campaignId = (await prisma.campaign.create({ data: { organizationId: orgId, loopTemplateId: loop.id, loopVersion: 1, name: "B" } })).id;
});

after(async () => {
  await prisma.auditLog.deleteMany({ where: { adminId: actor } });
  await prisma.organization.deleteMany({ where: { id: orgId } });
  await prisma.user.deleteMany({ where: { email: { endsWith: `-${run}@example.test` } } });
  await prisma.$disconnect();
});

test("C01: applicants past retention are deleted; recent ones and the funnel row stay", async () => {
  const old = await candidate({ decision: "DECLINE", decidedAt: addMonths(new Date(), -13) });
  const recent = await candidate({ decision: "ADVANCE", decidedAt: addMonths(new Date(), -2) });
  const undecided = await candidate({ completedAt: addMonths(new Date(), -14) });
  await purgeExpiredApplicants(1000);

  const gone = await prisma.invite.findUniqueOrThrow({ where: { id: old.id }, include: { run: true, reviews: true } });
  assert.ok(gone.redactedAt);
  assert.equal(gone.name, null);
  assert.match(gone.email, /@redacted\.invalid$/);
  assert.equal(gone.run, null, "transcript and scores deleted");
  assert.equal(gone.reviews.length, 0, "notes deleted");
  assert.equal(gone.decision, "DECLINE", "the bare row stays for counts");
  assert.equal((await findInviteByToken(old.token)).ok, false, "the link is dead");
  assert.ok((await prisma.invite.findUniqueOrThrow({ where: { id: undecided.id } })).redactedAt, "no decision: the clock starts at the interview");
  assert.equal((await prisma.invite.findUniqueOrThrow({ where: { id: recent.id } })).redactedAt, null);

  // A company with 1-month retention: the 2-month-old decision is now due.
  await prisma.organization.update({ where: { id: orgId }, data: { retentionMonths: 1 } });
  await purgeExpiredApplicants(1000);
  assert.ok((await prisma.invite.findUniqueOrThrow({ where: { id: recent.id } })).redactedAt);
  await prisma.organization.update({ where: { id: orgId }, data: { retentionMonths: 12 } });
});

test("C01: export returns everything; delete needs confirmation and removes it", async () => {
  const c = await candidate();
  const exported = await (await exportApplicantHandler(ctx(), c.id)).json();
  assert.equal(exported.applicant.name, "Pat");
  assert.equal(exported.rounds[0].transcript[0].text, "Something personal about me.");
  assert.equal(exported.reviews[0].body, "A note about Pat.");
  assert.equal((await deleteApplicantHandler(ctx(), req({ confirm: "yes" }), c.id)).status, 400);
  assert.equal((await deleteApplicantHandler(ctx(), req({ confirm: "DELETE" }), c.id)).status, 200);
  assert.ok((await prisma.invite.findUniqueOrThrow({ where: { id: c.id } })).redactedAt);
});

test("R07: two recruiters inviting the same person to a role at once make one candidate", async () => {
  const roleId = String((await (await h.createRoleHandler(ctx(), req({ title: "Race role", loopTemplateId: loopId }))).json()).id);
  const email = `same-${run}@example.test`;
  const results = await Promise.all(
    [1, 2, 3].map(() => h.createCampaignHandler(ctx(), req({ loopTemplateId: loopId, hiringRoleId: roleId, recipients: [{ email, name: "Same" }] }))),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409, 409]);
  assert.equal(await prisma.invite.count({ where: { email, campaign: { hiringRoleId: roleId } } }), 1);
  // A cancelled invite doesn't block inviting them again.
  await prisma.invite.updateMany({ where: { email }, data: { status: "REVOKED" } });
  assert.equal((await h.createCampaignHandler(ctx(), req({ loopTemplateId: loopId, hiringRoleId: roleId, recipients: [{ email, name: "Same" }] }))).status, 201);
});

test("C04: more than 1,000 candidates are all listed and counted", async () => {
  const big = (await prisma.campaign.create({ data: { organizationId: orgId, loopTemplateId: loopId, loopVersion: 1, name: "Big" } })).id;
  await prisma.invite.createMany({ data: Array.from({ length: 1005 }, (_, i) => ({ campaignId: big, email: `bulk${i}-${run}@example.test`, status: "SENT" as const })) });
  const rows = await listCandidates(orgId);
  assert.ok(rows.filter((r) => r.email.startsWith("bulk")).length === 1005);
});

test("C05: a note moves the candidate to the top by last activity", async () => {
  const a = await candidate();
  const b = await candidate();
  await prisma.invite.updateMany({ where: { id: { in: [a.id, b.id] } }, data: { lastActivityAt: new Date(Date.now() - 3600_000) } });
  await addNoteHandler(ctx(), req({ body: "Fresh thought" }), a.id);
  const rows = await listCandidates(orgId);
  assert.ok(rows.findIndex((r) => r.id === a.id) < rows.findIndex((r) => r.id === b.id));
});

test("R10: hiring teammates without practice set-up land in their workspace", async () => {
  assert.equal(await defaultDestination(actor, null), "/hire");
  assert.equal(await defaultDestination(actor, new Date()), "/dashboard");
  const loner = await prisma.user.create({ data: { email: `loner-${run}@example.test`, passwordHash: "x" } });
  assert.equal(await defaultDestination(loner.id, null), "/onboarding");
});
