import "./setup";
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { randomBytes } from "node:crypto";
import { prisma } from "../../lib/db";
import { processJobs } from "../../lib/jobs";
import { finishRound, rescoreRound, scoringHandlers, type Grader } from "../../lib/scoring";

const run = randomBytes(4).toString("hex");
let orgId = "";
let loopId = "";
let campaignId = "";

const QUESTIONS = [
  { questionId: "q1", version: 1, title: "Conflict", prompt: "Tell me about a disagreement.", followUps: [], signals: ["Owns their part"] },
  { questionId: "q2", version: 1, title: "Failure", prompt: "Tell me about a failure.", followUps: [], signals: ["Names a lesson"] },
];
const round = (id: string, minutes: number) => ({ id, category: "BEHAVIORAL", title: id, durationMinutes: minutes, candidateBrief: "", questions: { mode: "pool", count: 2, tags: [], roles: [], level: null } });

const goodReply = (s1: number, s2: number) =>
  JSON.stringify({
    questions: [
      { questionId: "q1", score: s1, evidence: "Specific story", missing: "" },
      { questionId: "q2", score: s2, evidence: "Named a lesson", missing: "" },
    ],
    strengths: ["Specific"],
    improvements: [],
    summary: "Clear.",
  });
const grader = (replies: (string | Error)[]) => {
  let i = 0;
  const g: Grader & { calls: () => number } = Object.assign(
    async () => {
      const r = replies[Math.min(i++, replies.length - 1)]!;
      if (r instanceof Error) throw r;
      return { text: r, model: "test-model" };
    },
    { calls: () => i },
  );
  return g;
};

/** A run with two rounds: 30 and 10 minutes. Returns round-run ids, both in progress. */
async function setupRun(spoke = true) {
  const inv = await prisma.invite.create({ data: { campaignId, email: `c-${randomBytes(3).toString("hex")}@example.test`, status: "STARTED" } });
  const lr = await prisma.loopRun.create({ data: { inviteId: inv.id, loopTemplateId: loopId, loopVersion: 1 } });
  const ids: string[] = [];
  for (const [i, id] of ["r1", "r2"].entries()) {
    const rr = await prisma.loopRoundRun.create({ data: { runId: lr.id, roundIndex: i, roundId: id, category: "BEHAVIORAL", questions: QUESTIONS } });
    await prisma.loopMessage.create({ data: { roundRunId: rr.id, role: "interviewer", content: "Tell me about a disagreement." } });
    if (spoke) await prisma.loopMessage.create({ data: { roundRunId: rr.id, role: "candidate", content: "I disagreed with my lead about a migration." } });
    ids.push(rr.id);
  }
  return { inviteId: inv.id, runId: lr.id, ids };
}
const dueNow = () => prisma.job.updateMany({ where: { state: "QUEUED" }, data: { runAfter: new Date(0) } });

before(async () => {
  const org = await prisma.organization.create({ data: { name: `Co ${run}`, slug: `co-s-${run}` } });
  orgId = org.id;
  const loop = await prisma.loopTemplate.create({ data: { name: "Loop", organizationId: org.id, status: "PUBLISHED", currentVersion: 1 } });
  loopId = loop.id;
  await prisma.loopTemplateVersion.create({ data: { loopTemplateId: loop.id, version: 1, snapshot: { config: { name: "Loop", rounds: [round("r1", 30), round("r2", 10)] }, totalMinutes: 40 } } });
  campaignId = (await prisma.campaign.create({ data: { organizationId: org.id, loopTemplateId: loop.id, loopVersion: 1, name: "Batch" } })).id;
});

after(async () => {
  await prisma.job.deleteMany({ where: { key: { startsWith: "score:" } } });
  await prisma.organization.deleteMany({ where: { id: orgId } });
  await prisma.$disconnect();
});

describe("scoring", () => {
  test("scores right away, records the attempt, and completes the run with a weighted overall", async () => {
    const { ids, runId, inviteId } = await setupRun();
    const r1 = await finishRound(ids[0]!, grader([goodReply(5, 5)])); // 100
    assert.equal(r1.status, "COMPLETED");
    assert.equal(r1.score, 100);
    await finishRound(ids[1]!, grader([goodReply(1, 3)])); // 25
    const lr = await prisma.loopRun.findUniqueOrThrow({ where: { id: runId } });
    assert.equal(lr.status, "COMPLETED");
    assert.equal(lr.overallScore, 81, "(100×30 + 25×10) / 40");
    assert.deepEqual([lr.assessedQuestions, lr.totalQuestions], [4, 4]);
    assert.equal((await prisma.invite.findUniqueOrThrow({ where: { id: inviteId } })).status, "COMPLETED");
    assert.equal(await prisma.scoringAttempt.count({ where: { roundRunId: ids[0]!, status: "SUCCEEDED" } }), 1);
  });

  test("a model failure retries in the background; the applicant doesn't redo anything", async () => {
    const { ids } = await setupRun();
    const flaky = grader([new Error("overloaded"), goodReply(4, 4)]);
    const first = await finishRound(ids[0]!, flaky);
    assert.equal(first.status, "SCORING", "still scoring after the failed inline try");
    const job = await prisma.job.findFirstOrThrow({ where: { key: `score:${ids[0]}` } });
    assert.equal(job.state, "QUEUED");
    assert.ok(job.runAfter > new Date(), "backs off before retrying");
    await dueNow();
    await processJobs(scoringHandlers(flaky), { key: `score:${ids[0]}` });
    const rr = await prisma.loopRoundRun.findUniqueOrThrow({ where: { id: ids[0]! }, include: { attempts: { orderBy: { attempt: "asc" } } } });
    assert.equal(rr.status, "COMPLETED");
    assert.equal(rr.score, 75);
    assert.deepEqual(rr.attempts.map((a) => a.status), ["ERROR", "SUCCEEDED"]);
  });

  test("a reply that skips a question is rejected and retried, not half-saved", async () => {
    const { ids } = await setupRun();
    const partial = JSON.stringify({ questions: [{ questionId: "q1", score: 5, evidence: "x" }], summary: "s" });
    const g = grader([partial, goodReply(3, 3)]);
    await finishRound(ids[0]!, g);
    let rr = await prisma.loopRoundRun.findUniqueOrThrow({ where: { id: ids[0]! }, include: { attempts: true } });
    assert.equal(rr.status, "SCORING");
    assert.equal(rr.scorecard, null);
    assert.match(rr.attempts[0]!.error ?? "", /q2 wasn't graded/);
    await dueNow();
    await processJobs(scoringHandlers(g), { key: `score:${ids[0]}` });
    rr = await prisma.loopRoundRun.findUniqueOrThrow({ where: { id: ids[0]! }, include: { attempts: true } });
    assert.equal(rr.status, "COMPLETED");
  });

  test("after the last attempt fails the round says so and can be re-scored", async () => {
    const { ids } = await setupRun();
    const broken = grader([new Error("down")]);
    await finishRound(ids[0]!, broken);
    for (let i = 0; i < 6; i++) {
      await dueNow();
      await processJobs(scoringHandlers(broken), { key: `score:${ids[0]}` });
    }
    assert.equal(broken.calls(), 5, "gives up after 5 attempts");
    assert.equal((await prisma.loopRoundRun.findUniqueOrThrow({ where: { id: ids[0]! } })).status, "SCORING_FAILED");
    assert.equal((await prisma.job.findFirstOrThrow({ where: { key: `score:${ids[0]}` } })).state, "FAILED");
    const again = await rescoreRound(ids[0]!, grader([goodReply(2, 2)]));
    assert.equal(again.status, "COMPLETED");
    assert.equal(again.score, 25);
  });

  test("a failed re-score keeps the earlier valid scorecard", async () => {
    const { ids } = await setupRun();
    await finishRound(ids[0]!, grader([goodReply(5, 5)]));
    const broken = grader([new Error("down")]);
    await rescoreRound(ids[0]!, broken);
    for (let i = 0; i < 5; i++) {
      await dueNow();
      await processJobs(scoringHandlers(broken), { key: `score:${ids[0]}` });
    }
    const rr = await prisma.loopRoundRun.findUniqueOrThrow({ where: { id: ids[0]! } });
    assert.equal(rr.status, "COMPLETED");
    assert.equal(rr.score, 100);
  });

  test("double finish and double re-score make one job and one score", async () => {
    const { ids } = await setupRun();
    const g = grader([goodReply(4, 4)]);
    await Promise.all([finishRound(ids[0]!, g), finishRound(ids[0]!, g)]);
    assert.equal(await prisma.scoringAttempt.count({ where: { roundRunId: ids[0]! } }), 1);
    await Promise.all([rescoreRound(ids[0]!, g), rescoreRound(ids[0]!, g)]);
    assert.equal(await prisma.scoringAttempt.count({ where: { roundRunId: ids[0]!, status: "SUCCEEDED" } }), 2, "the second click joins the first");
  });

  test("a silent round completes with no score and never calls the model", async () => {
    const { ids } = await setupRun(false);
    const g = grader([goodReply(5, 5)]);
    const rr = await finishRound(ids[0]!, g);
    assert.equal(rr.status, "COMPLETED");
    assert.equal(rr.score, null);
    assert.equal(g.calls(), 0);
  });
});
