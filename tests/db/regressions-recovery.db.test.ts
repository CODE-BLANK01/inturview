// Regression tests for the October 15 review: R02, R05, R06, C08, C10.
import "./setup";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomBytes } from "node:crypto";
import { prisma } from "../../lib/db";
import { processJobs } from "../../lib/jobs";
import { finishRound, recoverOrphanedScoring, rescoreRound, scoringHandlers, type Grader } from "../../lib/scoring";
import { claimReply, interviewerEndedRound, recordAnswer, releaseReply, saveDraft } from "../../lib/roundAnswers";

const run = randomBytes(4).toString("hex");
let orgId = "", loopId = "", campaignId = "";
const QUESTIONS = [{ questionId: "q1", version: 1, title: "Q", prompt: "Tell me about a hard call.", followUps: [], signals: [] }];
const good = (score: number): Grader => async () => ({ text: JSON.stringify({ questions: [{ questionId: "q1", score, evidence: "x" }], summary: "s" }), model: "test" });
const broken: Grader = async () => { throw new Error("down"); };
const round = (id: string) => ({ id, category: "BEHAVIORAL", title: `Round ${id}`, durationMinutes: 20, candidateBrief: "", questions: { mode: "pool", count: 1, tags: [], roles: [], level: null } });

async function newRun(roundCount: number) {
  const inv = await prisma.invite.create({ data: { campaignId, email: `c-${randomBytes(3).toString("hex")}@example.test`, status: "STARTED" } });
  const lr = await prisma.loopRun.create({ data: { inviteId: inv.id, loopTemplateId: loopId, loopVersion: 1 } });
  const ids: string[] = [];
  for (let i = 0; i < roundCount; i++) {
    const rr = await prisma.loopRoundRun.create({ data: { runId: lr.id, roundIndex: i, roundId: `r${i}`, category: "BEHAVIORAL", questions: QUESTIONS } });
    await prisma.loopMessage.create({ data: { roundRunId: rr.id, role: "candidate", content: "An answer." } });
    ids.push(rr.id);
  }
  return { runId: lr.id, ids };
}
const due = () => prisma.job.updateMany({ where: { state: "QUEUED" }, data: { runAfter: new Date(0) } });

before(async () => {
  orgId = (await prisma.organization.create({ data: { name: `Co ${run}`, slug: `rc-${run}` } })).id;
  const loop = await prisma.loopTemplate.create({ data: { name: "L", organizationId: orgId, status: "PUBLISHED", currentVersion: 1 } });
  loopId = loop.id;
  await prisma.loopTemplateVersion.create({ data: { loopTemplateId: loop.id, version: 1, snapshot: { config: { name: "L", rounds: [round("r0"), round("r1")] }, totalMinutes: 40 } } });
  campaignId = (await prisma.campaign.create({ data: { organizationId: orgId, loopTemplateId: loop.id, loopVersion: 1, name: "B" } })).id;
});

after(async () => {
  await prisma.job.deleteMany({ where: { key: { startsWith: "score:" } } });
  await prisma.organization.deleteMany({ where: { id: orgId } });
  await prisma.$disconnect();
});

test("R02: a round left scoring with no job is repaired by Finish and by the sweep", async () => {
  const { ids } = await newRun(2);
  // The old failure: status moved to SCORING, the job never got created.
  await prisma.loopRoundRun.update({ where: { id: ids[0]! }, data: { status: "SCORING", completedAt: new Date() } });
  const again = await finishRound(ids[0]!, good(4));
  assert.equal(again.status, "COMPLETED", "pressing Finish again scores it");

  await prisma.loopRoundRun.update({ where: { id: ids[1]! }, data: { status: "SCORING", completedAt: new Date() } });
  assert.ok((await recoverOrphanedScoring()) >= 1);
  assert.equal(await prisma.job.count({ where: { key: `score:${ids[1]}`, state: "QUEUED" } }), 1, "the worker's sweep queued it");
});

test("R02b: finishing queues the job in the same transaction as the status change", async () => {
  const { ids } = await newRun(1);
  await finishRound(ids[0]!, undefined, { inline: false });
  const rr = await prisma.loopRoundRun.findUniqueOrThrow({ where: { id: ids[0]! } });
  assert.equal(rr.status, "SCORING");
  assert.equal(await prisma.job.count({ where: { key: `score:${ids[0]}`, state: "QUEUED" } }), 1);
});

test("R05: a re-score that falls back to the earlier score still completes the interview", async () => {
  const { runId, ids } = await newRun(2);
  await finishRound(ids[0]!, good(5)); // round 0 scored
  await rescoreRound(ids[0]!, broken); // re-score fails once inline…
  await finishRound(ids[1]!, good(3)); // …round 1 finishes while round 0 is re-scoring
  assert.notEqual((await prisma.loopRun.findUniqueOrThrow({ where: { id: runId } })).status, "COMPLETED");
  for (let i = 0; i < 5; i++) {
    await due();
    await processJobs(scoringHandlers(broken), { key: `score:${ids[0]}` });
  }
  const lr = await prisma.loopRun.findUniqueOrThrow({ where: { id: runId } });
  assert.equal(lr.status, "COMPLETED");
  assert.equal(lr.overallScore, 75, "(100 + 50) / 2, both 20 minutes");
});

test("R06: a round the interviewer closed is recognised as ended", async () => {
  const { ids } = await newRun(1);
  assert.equal(await interviewerEndedRound(ids[0]!), false);
  await prisma.loopMessage.create({ data: { roundRunId: ids[0]!, role: "interviewer", content: "Thanks, that's everything.", endsRound: true } });
  assert.equal(await interviewerEndedRound(ids[0]!), true);
});

test("C08: drafts save in order, and a sent answer can't be brought back by a late autosave", async () => {
  const { ids } = await newRun(1);
  const rr = ids[0]!;
  assert.equal(await saveDraft(rr, "newer", 200), true);
  assert.equal(await saveDraft(rr, "older, arriving late", 100), false);
  assert.equal((await prisma.loopRoundRun.findUniqueOrThrow({ where: { id: rr } })).draft, "newer");
  await recordAnswer(rr, "turn-zzzzzzzz", "The sent answer", 300);
  assert.equal(await saveDraft(rr, "The sent answer", 250), false, "an autosave from before sending is stale");
  assert.equal((await prisma.loopRoundRun.findUniqueOrThrow({ where: { id: rr } })).draft, null);
  assert.equal(await saveDraft(rr, "typing the next answer", 400), true);
});

test("C10: one writer per reply; a failed writer releases it", async () => {
  const { ids } = await newRun(1);
  const { answer } = await recordAnswer(ids[0]!, "turn-cccccccc", "Answer");
  const claims = await Promise.all([claimReply(answer.id), claimReply(answer.id), claimReply(answer.id)]);
  assert.equal(claims.filter(Boolean).length, 1);
  await releaseReply(answer.id);
  assert.equal(await claimReply(answer.id), true);
  // A writer that vanished long ago doesn't block forever.
  await prisma.loopMessage.update({ where: { id: answer.id }, data: { replyClaimedAt: new Date(Date.now() - 10 * 60_000) } });
  assert.equal(await claimReply(answer.id), true);
});
