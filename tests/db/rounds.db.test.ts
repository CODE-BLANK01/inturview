import "./setup";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomBytes } from "node:crypto";
import { prisma } from "../../lib/db";
import { recordAnswer, replyTo, saveReply } from "../../lib/roundAnswers";
import { finishOverdueRounds } from "../../lib/scoring";

const run = randomBytes(4).toString("hex");
let orgId = "";
let runId = "";

async function round(index: number, deadlineAt: Date | null = null) {
  return prisma.loopRoundRun.create({
    data: { runId, roundIndex: index, roundId: `r${index}`, category: "BEHAVIORAL", questions: [], deadlineAt, draft: "half an answer", draftSavedAt: new Date() },
  });
}

before(async () => {
  const org = await prisma.organization.create({ data: { name: `Co ${run}`, slug: `co-r-${run}` } });
  orgId = org.id;
  const loop = await prisma.loopTemplate.create({ data: { name: "Loop", organizationId: org.id, status: "PUBLISHED", currentVersion: 1 } });
  await prisma.loopTemplateVersion.create({ data: { loopTemplateId: loop.id, version: 1, snapshot: { config: { name: "Loop", rounds: [] }, totalMinutes: 0 } } });
  const campaign = await prisma.campaign.create({ data: { organizationId: org.id, loopTemplateId: loop.id, loopVersion: 1, name: "B" } });
  const inv = await prisma.invite.create({ data: { campaignId: campaign.id, email: `r-${run}@example.test`, status: "STARTED" } });
  runId = (await prisma.loopRun.create({ data: { inviteId: inv.id, loopTemplateId: loop.id, loopVersion: 1 } })).id;
});

after(async () => {
  await prisma.job.deleteMany({ where: { key: { startsWith: "score:" } } });
  await prisma.organization.deleteMany({ where: { id: orgId } });
  await prisma.$disconnect();
});

test("the same answer sent twice at once is stored once, and clears the draft", async () => {
  const rr = await round(0);
  const results = await Promise.all([recordAnswer(rr.id, "turn-aaaaaaaa", "My answer"), recordAnswer(rr.id, "turn-aaaaaaaa", "My answer")]);
  assert.equal(results.filter((r) => r.isNew).length, 1);
  assert.equal(results[0].answer.id, results[1].answer.id);
  assert.equal(await prisma.loopMessage.count({ where: { roundRunId: rr.id, role: "candidate" } }), 1);
  assert.equal((await prisma.loopRoundRun.findUniqueOrThrow({ where: { id: rr.id } })).draft, null);
  // A different answer is a different turn.
  assert.equal((await recordAnswer(rr.id, "turn-bbbbbbbb", "Another")).isNew, true);
});

test("one reply per answer, even when two retries finish at once", async () => {
  const rr = await round(1);
  const { answer } = await recordAnswer(rr.id, "turn-cccccccc", "Answer");
  const [a, b] = await Promise.all([saveReply(rr.id, answer.id, "Reply one", false), saveReply(rr.id, answer.id, "Reply two", true)]);
  assert.equal(a.id, b.id, "the second save returns the first");
  assert.equal(await prisma.loopMessage.count({ where: { replyToId: answer.id } }), 1);
  assert.equal((await replyTo(answer.id))?.id, a.id);
});

test("rounds past their hard deadline are closed and queued for scoring", async () => {
  const late = await round(2, new Date(Date.now() - 60_000));
  const onTime = await round(3, new Date(Date.now() + 60 * 60_000));
  assert.ok((await finishOverdueRounds()) >= 1);
  const l = await prisma.loopRoundRun.findUniqueOrThrow({ where: { id: late.id } });
  assert.equal(l.status, "SCORING");
  assert.equal(l.draft, null);
  assert.equal(await prisma.job.count({ where: { key: `score:${late.id}`, state: "QUEUED" } }), 1);
  assert.equal((await prisma.loopRoundRun.findUniqueOrThrow({ where: { id: onTime.id } })).status, "IN_PROGRESS");
});
