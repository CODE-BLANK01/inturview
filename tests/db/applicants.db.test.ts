import "./setup";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomBytes } from "node:crypto";
import { QuestionCategory } from "@prisma/client";
import { prisma } from "../../lib/db";
import { createQuestion, publishQuestion } from "../../lib/questionBank";
import { publishLoop } from "../../lib/loopTemplates";
import { hashInviteToken, newInviteToken } from "../../lib/invites";
import { loadLoopContext, startRound } from "../../lib/loopRuns";

const run = randomBytes(4).toString("hex");
const applicantEmail = `applicant-${run}@example.test`;
let orgId = "";
let token = "";

before(async () => {
  const org = await prisma.organization.create({ data: { name: `Co ${run}`, slug: `co-${run}` } });
  orgId = org.id;
  const q = await createQuestion(
    { category: QuestionCategory.BEHAVIORAL, title: `Q ${run}`, prompt: "Tell me about a project you're proud of and why.", followUps: [], signals: [], levels: [], roles: [], tags: [], difficulty: null, details: null },
    { organizationId: org.id },
  );
  await publishQuestion(q.id, null);
  const loop = await prisma.loopTemplate.create({
    data: {
      name: "Loop",
      organizationId: org.id,
      rounds: [{ id: "r1", category: "BEHAVIORAL", title: "Behavioral", durationMinutes: 20, candidateBrief: "", questions: { mode: "fixed", questionIds: [q.id] } }],
    },
  });
  await publishLoop(loop.id, null);
  const campaign = await prisma.campaign.create({ data: { organizationId: org.id, loopTemplateId: loop.id, loopVersion: 1, name: "Batch" } });
  const t = newInviteToken();
  token = t.raw;
  await prisma.invite.create({
    data: { campaignId: campaign.id, email: applicantEmail, name: "Ada", tokenHash: t.hash, status: "SENT", sentAt: new Date(), expiresAt: new Date(Date.now() + 86_400_000), consentedAt: new Date() },
  });
});

after(async () => {
  await prisma.organization.deleteMany({ where: { id: orgId } });
  await prisma.user.deleteMany({ where: { email: applicantEmail } });
  await prisma.$disconnect();
});

test("starting an interview creates no account and links to none", async () => {
  assert.equal(hashInviteToken(token).length, 64);
  const ctx = await loadLoopContext(token);
  const { roundRun } = await startRound(ctx, 0);
  assert.equal(await prisma.user.count({ where: { email: applicantEmail } }), 0);
  const lr = await prisma.loopRun.findUniqueOrThrow({ where: { id: roundRun.runId }, include: { invite: true } });
  assert.equal(lr.userId, null);
  assert.equal(lr.invite.userId, null);
  assert.equal(lr.invite.status, "STARTED");
});

test("an applicant who already practices on inturview stays unlinked", async () => {
  // Same email as an existing practice account: still nothing connects them.
  const practice = await prisma.user.create({ data: { email: applicantEmail, passwordHash: "x" } });
  const ctx = await loadLoopContext(token);
  await startRound(ctx, 0);
  const inv = await prisma.invite.findFirstOrThrow({ where: { email: applicantEmail }, include: { run: true } });
  assert.equal(inv.userId, null);
  assert.equal(inv.run?.userId, null);
  assert.notEqual(inv.run?.userId, practice.id);
});
