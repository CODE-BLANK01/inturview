import "./setup";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import { prisma } from "../../lib/db";
import type { HiringCtx } from "../../lib/hiring/handlers";
import { addNoteHandler, assignHandler, decideHandler, rateHandler, reviewPanel, unassignHandler, visibleCandidate } from "../../lib/hiring/reviews";
import { listCandidates } from "../../lib/hiring/candidates";

const run = randomBytes(4).toString("hex");
const req = (body?: unknown, url = "http://test.local/api") =>
  new NextRequest(url, body === undefined ? { method: "DELETE" } : { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
let orgA = "", orgB = "", candidate = "", other = "";
const users: Record<string, string> = {};
const recruiter = (): HiringCtx => ({ organizationId: orgA, actorId: users.rec!, canViewAll: true });
const reviewer = (who: "r1" | "r2"): HiringCtx => ({ organizationId: orgA, actorId: users[who]!, canViewAll: false });

before(async () => {
  for (const w of ["rec", "r1", "r2", "outsider"]) users[w] = (await prisma.user.create({ data: { email: `${w}-${run}@example.test`, name: w, passwordHash: "x" } })).id;
  orgA = (await prisma.organization.create({ data: { name: `A ${run}`, slug: `rv-a-${run}` } })).id;
  orgB = (await prisma.organization.create({ data: { name: `B ${run}`, slug: `rv-b-${run}` } })).id;
  await prisma.organizationMember.createMany({
    data: [
      { organizationId: orgA, userId: users.rec!, role: "RECRUITER" },
      { organizationId: orgA, userId: users.r1!, role: "REVIEWER" },
      { organizationId: orgA, userId: users.r2!, role: "REVIEWER" },
      { organizationId: orgB, userId: users.outsider!, role: "OWNER" },
    ],
  });
  const loop = await prisma.loopTemplate.create({ data: { name: "L", organizationId: orgA, status: "PUBLISHED", currentVersion: 1 } });
  const campaign = await prisma.campaign.create({ data: { organizationId: orgA, loopTemplateId: loop.id, loopVersion: 1, name: "B" } });
  candidate = (await prisma.invite.create({ data: { campaignId: campaign.id, email: `cand-${run}@example.test`, status: "COMPLETED" } })).id;
  other = (await prisma.invite.create({ data: { campaignId: campaign.id, email: `other-${run}@example.test`, status: "COMPLETED" } })).id;
});

after(async () => {
  await prisma.auditLog.deleteMany({ where: { adminId: { in: Object.values(users) } } });
  await prisma.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: `-${run}@example.test` } } });
  await prisma.$disconnect();
});

test("reviewers see only what's assigned to them", async () => {
  assert.equal(await visibleCandidate(orgA, candidate, { userId: users.r1!, canViewAll: false }), null);
  assert.equal((await addNoteHandler(reviewer("r1"), req({ body: "Sneaky" }), candidate)).status, 404);
  assert.equal((await assignHandler(recruiter(), req({ userId: users.r1 }), candidate)).status, 200);
  assert.ok(await visibleCandidate(orgA, candidate, { userId: users.r1!, canViewAll: false }));
  assert.equal((await addNoteHandler(reviewer("r1"), req({ body: "Clear thinker." }), candidate)).status, 201);
  const mine = await listCandidates(orgA, { assignedTo: users.r1 });
  assert.deepEqual(mine.map((c) => c.id), [candidate], "the other candidate isn't in their list");
});

test("only workspace members can be assigned, and other workspaces can't touch candidates", async () => {
  assert.equal((await assignHandler(recruiter(), req({ userId: users.outsider }), candidate)).status, 400);
  const outsider: HiringCtx = { organizationId: orgB, actorId: users.outsider!, canViewAll: true };
  assert.equal((await addNoteHandler(outsider, req({ body: "Hi" }), candidate)).status, 404);
  assert.equal((await decideHandler(outsider, req({ decision: "ADVANCE" }), candidate)).status, 404);
});

test("ratings are blind until you've rated", async () => {
  await assignHandler(recruiter(), req({ userId: users.r2 }), candidate);
  assert.equal((await rateHandler(reviewer("r1"), req({ rating: 4 }), candidate)).status, 201);
  let p2 = await reviewPanel(orgA, candidate, users.r2!, false);
  assert.equal(p2.ratings.count, 1);
  assert.equal(p2.ratings.average, null);
  assert.equal(p2.ratings.others, null);
  assert.ok(p2.feed.every((f) => f.kind !== "RATING"), "the feed hides ratings too");
  assert.equal((await rateHandler(reviewer("r2"), req({ rating: 2 }), candidate)).status, 201);
  p2 = await reviewPanel(orgA, candidate, users.r2!, false);
  assert.equal(p2.ratings.average, 3);
  assert.deepEqual(p2.ratings.others, [{ author: "r1", rating: 4 }]);
  // A re-rating replaces the person's earlier one.
  await rateHandler(reviewer("r1"), req({ rating: 5 }), candidate);
  assert.equal((await reviewPanel(orgA, candidate, users.rec!, true)).ratings.average, 3.5);
  assert.equal((await rateHandler(reviewer("r1"), req({ rating: 9 }), candidate)).status, 400);
});

test("decisions are logged, the latest wins, and the stage follows", async () => {
  assert.equal((await decideHandler(recruiter(), req({ decision: "ADVANCE", body: "Strong design round." }), candidate)).status, 200);
  assert.equal((await decideHandler(recruiter(), req({ decision: "DECLINE" }), candidate)).status, 200);
  const inv = await prisma.invite.findUniqueOrThrow({ where: { id: candidate } });
  assert.equal(inv.decision, "DECLINE");
  assert.ok(inv.decidedAt);
  assert.equal(await prisma.review.count({ where: { inviteId: candidate, kind: "DECISION" } }), 2);
  assert.equal((await listCandidates(orgA)).find((c) => c.id === candidate)?.stage, "declined");
  const panel = await reviewPanel(orgA, candidate, users.rec!, true);
  assert.equal(panel.decision?.value, "DECLINE");
  assert.equal(panel.decision?.by, "rec");
});

test("unassigning takes access away", async () => {
  await unassignHandler(recruiter(), req(undefined, `http://test.local/api?userId=${users.r2}`), candidate);
  assert.equal(await visibleCandidate(orgA, candidate, { userId: users.r2!, canViewAll: false }), null);
  assert.equal(await visibleCandidate(orgA, other, { userId: users.r1!, canViewAll: false }), null);
});
