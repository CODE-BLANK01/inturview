// Regression tests for the October 15 review (R01, R04, R09). Each failed before its fix.
import "./setup";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import { QuestionCategory } from "@prisma/client";
import { prisma } from "../../lib/db";
import { createQuestion, publishQuestion } from "../../lib/questionBank";
import { publishLoop, setLoopArchived } from "../../lib/loopTemplates";
import { cancelInvite } from "../../lib/delivery";
import { findInviteByToken, newInviteToken } from "../../lib/invites";
import { loadLoopContext, startRound } from "../../lib/loopRuns";
import { finishRound, type Grader } from "../../lib/scoring";
import * as h from "../../lib/hiring/handlers";

const run = randomBytes(4).toString("hex");
const req = (body: unknown) => new NextRequest("http://test.local/api", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
let orgId = "";
let actor = "";
let qid = "";
const rounds = (questionIds: string[]) => [{ id: "r1", category: "BEHAVIORAL", title: "Round one", durationMinutes: 20, candidateBrief: "", questions: { mode: "fixed", questionIds } }];

before(async () => {
  orgId = (await prisma.organization.create({ data: { name: `Co ${run}`, slug: `rg-${run}` } })).id;
  actor = (await prisma.user.create({ data: { email: `rg-${run}@example.test`, passwordHash: "x" } })).id;
  qid = (await createQuestion({ category: QuestionCategory.BEHAVIORAL, title: "Q", prompt: "Tell me about a hard call you made.", followUps: [], signals: [], levels: [], roles: [], tags: [], difficulty: null, details: null }, { organizationId: orgId })).id;
  await publishQuestion(qid, null);
});

after(async () => {
  await prisma.job.deleteMany({ where: { key: { startsWith: "score:" } } });
  await prisma.auditLog.deleteMany({ where: { adminId: actor } });
  await prisma.organization.deleteMany({ where: { id: orgId } });
  await prisma.loopTemplate.deleteMany({ where: { organizationId: null, name: `Template ${run}` } });
  await prisma.user.deleteMany({ where: { id: actor } });
  await prisma.$disconnect();
});

test("R01: scoring that finishes after a cancel doesn't bring the invite back", async () => {
  const loop = await prisma.loopTemplate.create({ data: { name: "L", organizationId: orgId, rounds: rounds([qid]) } });
  await publishLoop(loop.id, null);
  const campaign = await prisma.campaign.create({ data: { organizationId: orgId, loopTemplateId: loop.id, loopVersion: 1, name: "B" } });
  const t = newInviteToken();
  const inv = await prisma.invite.create({ data: { campaignId: campaign.id, email: `c-${run}@example.test`, tokenHash: t.hash, status: "SENT", expiresAt: new Date(Date.now() + 864e5), consentedAt: new Date() } });
  const { roundRun } = await startRound(await loadLoopContext(t.raw), 0);
  await prisma.loopMessage.create({ data: { roundRunId: roundRun.id, role: "candidate", content: "An answer." } });
  // The grade comes back after the recruiter cancelled the invite.
  const slowGrader: Grader = async () => {
    await cancelInvite(inv.id);
    return { text: JSON.stringify({ questions: [{ questionId: qid, score: 3, evidence: "x" }], summary: "s" }), model: "test" };
  };
  await finishRound(roundRun.id, slowGrader);
  assert.equal((await prisma.invite.findUniqueOrThrow({ where: { id: inv.id } })).status, "REVOKED");
  assert.equal((await findInviteByToken(t.raw)).ok, false, "the cancelled link stays dead");
});

test("R01b: a cancel between loading the link and starting a round isn't undone", async () => {
  const loop = await prisma.loopTemplate.create({ data: { name: "L2", organizationId: orgId, rounds: rounds([qid]) } });
  await publishLoop(loop.id, null);
  const campaign = await prisma.campaign.create({ data: { organizationId: orgId, loopTemplateId: loop.id, loopVersion: 1, name: "B2" } });
  const t = newInviteToken();
  const inv = await prisma.invite.create({ data: { campaignId: campaign.id, email: `c2-${run}@example.test`, tokenHash: t.hash, status: "SENT", expiresAt: new Date(Date.now() + 864e5), consentedAt: new Date() } });
  const ctx = await loadLoopContext(t.raw);
  await cancelInvite(inv.id);
  await startRound(ctx, 0).catch(() => undefined);
  assert.equal((await prisma.invite.findUniqueOrThrow({ where: { id: inv.id } })).status, "REVOKED");
});

test("R04: an archive made while a publish is running isn't undone by the publish", async () => {
  const loop = await prisma.loopTemplate.create({ data: { name: "L3", organizationId: orgId, rounds: rounds([qid]) } });
  // Archive lands after publish has read the loop and before it writes.
  const outcome = await publishLoop(loop.id, null, 0, { beforeWrite: () => setLoopArchived(loop.id, true, 0).then(() => undefined) }).then(
    () => "published",
    (e: Error) => e.constructor.name,
  );
  assert.equal(outcome, "LoopChangedError");
  const after = await prisma.loopTemplate.findUniqueOrThrow({ where: { id: loop.id } });
  assert.equal(after.status, "ARCHIVED");
  assert.equal(await prisma.loopTemplateVersion.count({ where: { loopTemplateId: loop.id } }), 0, "the publish rolled back entirely");
});

test("R09: copying a template takes its published details, not draft edits", async () => {
  const pq = await createQuestion({ category: QuestionCategory.BEHAVIORAL, title: "P", prompt: "Platform question for the template test.", followUps: [], signals: [], levels: [], roles: [], tags: [], difficulty: null, details: null }, {});
  await publishQuestion(pq.id, null);
  const tpl = await prisma.loopTemplate.create({ data: { name: `Template ${run}`, description: "Published description", level: "mid", rounds: rounds([pq.id]) } });
  await publishLoop(tpl.id, null);
  await prisma.loopTemplate.update({ where: { id: tpl.id }, data: { name: "Unpublished draft name", description: "Draft description", level: "senior" } });
  const res = await h.createLoopHandler({ organizationId: orgId, actorId: actor }, req({ fromTemplateId: tpl.id }));
  const copy = await prisma.loopTemplate.findUniqueOrThrow({ where: { id: String((await res.json()).id) } });
  assert.deepEqual([copy.name, copy.description, copy.level], [`Template ${run}`, "Published description", "mid"]);
  await prisma.question.delete({ where: { id: pq.id } }).catch(() => undefined);
});
