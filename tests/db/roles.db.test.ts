import "./setup";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import { prisma } from "../../lib/db";
import * as h from "../../lib/hiring/handlers";
import { listCandidates } from "../../lib/hiring/candidates";

const run = randomBytes(4).toString("hex");
const req = (body: unknown) => new NextRequest("http://test.local/api", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
const json = async (r: Response) => ({ status: r.status, body: (await r.json()) as Record<string, unknown> });
let A: h.HiringCtx, B: h.HiringCtx;
let loopA = "", loopB = "";

async function publishedLoop(organizationId: string) {
  const loop = await prisma.loopTemplate.create({ data: { name: "Loop", organizationId, status: "PUBLISHED", currentVersion: 1 } });
  await prisma.loopTemplateVersion.create({
    data: { loopTemplateId: loop.id, version: 1, snapshot: { config: { name: "Loop", rounds: [{ id: "r1", category: "BEHAVIORAL", title: "R", durationMinutes: 20, candidateBrief: "", questions: { mode: "pool", count: 1, tags: [], roles: [], level: null } }] }, totalMinutes: 20 } },
  });
  return loop.id;
}

before(async () => {
  const [ua, ub] = await Promise.all(["a", "b"].map((w) => prisma.user.create({ data: { email: `${w}-${run}@example.test`, passwordHash: "x" } })));
  const [oa, ob] = await Promise.all(["a", "b"].map((w) => prisma.organization.create({ data: { name: `${w} ${run}`, slug: `ro-${w}-${run}` } })));
  A = { organizationId: oa!.id, actorId: ua!.id };
  B = { organizationId: ob!.id, actorId: ub!.id };
  loopA = await publishedLoop(oa!.id);
  loopB = await publishedLoop(ob!.id);
});

after(async () => {
  await prisma.auditLog.deleteMany({ where: { adminId: { in: [A.actorId, B.actorId] } } });
  await prisma.organization.deleteMany({ where: { id: { in: [A.organizationId!, B.organizationId!] } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: `-${run}@example.test` } } });
  await prisma.$disconnect();
});

test("roles stay in their workspace", async () => {
  const created = await json(await h.createRoleHandler(A, req({ title: "Backend engineer", loopTemplateId: loopA })));
  assert.equal(created.status, 201);
  const roleId = String(created.body.id);
  assert.equal((await h.updateRoleHandler(B, req({ title: "Hijacked" }), roleId)).status, 404);
  assert.equal((await h.createRoleHandler(A, req({ title: "Uses B's loop", loopTemplateId: loopB }))).status, 404, "another workspace's loop can't be a role's default");
  const steal = await h.createCampaignHandler(B, req({ loopTemplateId: loopB, hiringRoleId: roleId, recipients: [{ email: "x@y.test", name: null }] }));
  assert.equal(steal.status, 404, "B can't invite into A's role");
});

test("inviting from a role names the batch, skips people already invited, and lists them by stage", async () => {
  const roleId = String((await json(await h.createRoleHandler(A, req({ title: "Data engineer", loopTemplateId: loopA })))).body.id);
  const first = await json(await h.createCampaignHandler(A, req({ loopTemplateId: loopA, hiringRoleId: roleId, recipients: [{ email: `ada-${run}@example.test`, name: "Ada" }, { email: `bo-${run}@example.test`, name: null }] })));
  assert.equal(first.status, 201);
  const campaign = await prisma.campaign.findUniqueOrThrow({ where: { id: String(first.body.id) } });
  assert.equal(campaign.hiringRoleId, roleId);
  assert.match(campaign.name, /^Data engineer · \d{4}-\d{2}-\d{2}$/);

  const again = await json(await h.createCampaignHandler(A, req({ loopTemplateId: loopA, hiringRoleId: roleId, recipients: [{ email: `ADA-${run}@example.test`, name: "Ada" }, { email: `cy-${run}@example.test`, name: null }] })));
  assert.equal(again.body.added, 1);
  assert.equal(again.body.alreadyInvited, 1);
  assert.equal((await h.createCampaignHandler(A, req({ loopTemplateId: loopA, hiringRoleId: roleId, recipients: [{ email: `bo-${run}@example.test`, name: null }] }))).status, 409);

  // Move one candidate along: Ada failed delivery, Bo finished.
  await prisma.invite.updateMany({ where: { email: `ada-${run}@example.test` }, data: { status: "FAILED", lastError: "bounced" } });
  await prisma.invite.updateMany({ where: { email: `bo-${run}@example.test` }, data: { status: "COMPLETED" } });
  const rows = await listCandidates(A.organizationId!, { roleId });
  const stage = (email: string) => rows.find((r) => r.email === email)?.stage;
  assert.equal(stage(`ada-${run}@example.test`), "needs_attention");
  assert.equal(stage(`bo-${run}@example.test`), "ready");
  assert.equal(stage(`cy-${run}@example.test`), "queued");
  assert.deepEqual(await listCandidates(B.organizationId!), [], "B sees none of A's candidates");
});

test("a closed role takes no new invites", async () => {
  const roleId = String((await json(await h.createRoleHandler(A, req({ title: "Closed one" })))).body.id);
  assert.equal((await h.updateRoleHandler(A, req({ status: "CLOSED" }), roleId)).status, 200);
  const r = await h.createCampaignHandler(A, req({ loopTemplateId: loopA, hiringRoleId: roleId, recipients: [{ email: `z-${run}@example.test`, name: null }] }));
  assert.equal(r.status, 409);
});
