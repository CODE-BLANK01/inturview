import "./setup";
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import { QuestionCategory } from "@prisma/client";
import { prisma } from "../../lib/db";
import { createQuestion, publishQuestion, updateQuestion, type QuestionInput } from "../../lib/questionBank";
import { publishLoop } from "../../lib/loopTemplates";
import { newInviteToken } from "../../lib/invites";
import { LoopAccessError, loadLoopContext, startRound } from "../../lib/loopRuns";
import * as h from "../../lib/hiring/handlers";

const run = randomBytes(4).toString("hex");
const tag = `f${run}`;
let orgId = "";
let actor = "";
const req = (body: unknown) => new NextRequest("http://test.local/api", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });

const q = (title: string, prompt: string, details: Record<string, unknown> | null = null): QuestionInput => ({
  category: QuestionCategory.SYSTEM_DESIGN, title, prompt, followUps: [], signals: ["Scopes first"], levels: [], roles: [], tags: [tag], difficulty: null, details,
});

async function publishedQuestion(input: QuestionInput) {
  const created = await createQuestion(input, { organizationId: orgId });
  await publishQuestion(created.id, null);
  return created.id;
}

async function loopWith(rounds: unknown[]) {
  const loop = await prisma.loopTemplate.create({ data: { name: "Loop", organizationId: orgId, rounds: rounds as object[] } });
  await publishLoop(loop.id, null);
  return loop.id;
}

async function candidate(loopId: string) {
  const loop = await prisma.loopTemplate.findUniqueOrThrow({ where: { id: loopId } });
  const campaign = await prisma.campaign.create({ data: { organizationId: orgId, loopTemplateId: loopId, loopVersion: loop.currentVersion, name: "B" } });
  const t = newInviteToken();
  await prisma.invite.create({ data: { campaignId: campaign.id, email: `c-${randomBytes(3).toString("hex")}@example.test`, tokenHash: t.hash, status: "SENT", expiresAt: new Date(Date.now() + 864e5), consentedAt: new Date() } });
  return loadLoopContext(t.raw);
}

const designRound = (questions: unknown) => ({ id: "r1", category: "SYSTEM_DESIGN", title: "Design", durationMinutes: 30, candidateBrief: "", questions });

before(async () => {
  orgId = (await prisma.organization.create({ data: { name: `Co ${run}`, slug: `co-f-${run}` } })).id;
  actor = (await prisma.user.create({ data: { email: `f-${run}@example.test`, passwordHash: "x" } })).id;
});

after(async () => {
  await prisma.auditLog.deleteMany({ where: { adminId: actor } });
  await prisma.organization.deleteMany({ where: { id: orgId } });
  await prisma.user.deleteMany({ where: { id: actor } });
  await prisma.$disconnect();
});

describe("what candidates get is what was published", () => {
  test("later edits to a question don't reach candidates; details travel with it", async () => {
    const qid = await publishedQuestion(q("Rate limiter", "Design a rate limiter.", { constraints: ["10k rps"] }));
    const loopId = await loopWith([designRound({ mode: "fixed", questionIds: [qid] })]);
    await updateQuestion(qid, q("Rate limiter v2", "Design a global rate limiter across regions.", { constraints: ["1M rps"] }));
    await publishQuestion(qid, null);

    const { roundRun } = await startRound(await candidate(loopId), 0);
    const asked = roundRun.questions as { prompt: string; version: number; details: { constraints: string[] } }[];
    assert.equal(asked[0]!.prompt, "Design a rate limiter.");
    assert.equal(asked[0]!.version, 1);
    assert.deepEqual(asked[0]!.details.constraints, ["10k rps"]);
  });

  test("a pool is frozen at publish: questions published later aren't drawn", async () => {
    const first = await publishedQuestion(q("Pool A", "Design a URL shortener for a pool test."));
    const loopId = await loopWith([designRound({ mode: "pool", count: 1, tags: [tag], roles: [], level: null })]);
    const version = await prisma.loopTemplateVersion.findFirstOrThrow({ where: { loopTemplateId: loopId } });
    const frozenIds = ((version.snapshot as { config: { rounds: { questions: { frozenPool: { questionId: string }[] } }[] } }).config.rounds[0]!.questions.frozenPool).map((x) => x.questionId);
    assert.ok(frozenIds.includes(first));

    const late = await publishedQuestion(q("Pool late", "Published after the loop."));
    for (let i = 0; i < 6; i++) {
      const { roundRun } = await startRound(await candidate(loopId), 0);
      assert.notEqual((roundRun.questions as { questionId: string }[])[0]!.questionId, late);
    }
  });

  test("a round that can't be filled doesn't start, instead of running short", async () => {
    const qid = await publishedQuestion(q("Lonely", "The only one."));
    const loopId = await loopWith([designRound({ mode: "fixed", questionIds: [qid] })]);
    // Simulate a damaged version: the frozen copy is gone.
    const v = await prisma.loopTemplateVersion.findFirstOrThrow({ where: { loopTemplateId: loopId } });
    const snap = v.snapshot as { config: { rounds: { questions: { frozen: unknown[] } }[] } };
    snap.config.rounds[0]!.questions.frozen = [];
    await prisma.loopTemplateVersion.update({ where: { id: v.id }, data: { snapshot: snap as object } });
    await assert.rejects(startRound(await candidate(loopId), 0), (e) => e instanceof LoopAccessError && e.status === 500);
  });

  test("re-publishing unchanged content makes no new version", async () => {
    const qid = await publishedQuestion(q("Stable", "Unchanged."));
    const loopId = await loopWith([designRound({ mode: "fixed", questionIds: [qid] })]);
    await publishLoop(loopId, null);
    assert.equal(await prisma.loopTemplateVersion.count({ where: { loopTemplateId: loopId } }), 1);
  });
});

describe("editing safely", () => {
  const ctx = () => ({ organizationId: orgId, actorId: actor });
  const body = (revision: number, title = "Design") => ({ name: "Loop", description: null, roleTarget: null, level: null, rounds: [{ ...designRound({ mode: "pool", count: 1, tags: [tag], roles: [], level: null }), title }], revision });

  test("a save or publish from a stale tab is refused with the current revision", async () => {
    const loop = await prisma.loopTemplate.create({ data: { name: "Loop", organizationId: orgId } });
    assert.equal((await h.updateLoopHandler(ctx(), req(body(0, "Tab one")), loop.id)).status, 200);
    const stale = await h.updateLoopHandler(ctx(), req(body(0, "Tab two")), loop.id);
    assert.equal(stale.status, 409);
    const staleBody = await stale.json();
    assert.equal(staleBody.conflict, true);
    assert.equal(staleBody.revision, 1);
    const saved = await prisma.loopTemplate.findUniqueOrThrow({ where: { id: loop.id } });
    assert.equal((saved.rounds as { title: string }[])[0]!.title, "Tab one", "the stale save didn't overwrite");
    assert.equal((await h.loopStatusHandler(ctx(), req({ action: "publish", revision: 0 }), loop.id)).status, 409);
    assert.equal((await h.loopStatusHandler(ctx(), req({ action: "publish", revision: 1 }), loop.id)).status, 200);
  });

  test("status changes follow draft → published → archived → restored", async () => {
    const loop = await prisma.loopTemplate.create({ data: { name: "Loop", organizationId: orgId } });
    assert.equal((await h.loopStatusHandler(ctx(), req({ action: "restore", revision: 0 }), loop.id)).status, 409, "can't restore a draft");
    assert.equal((await h.loopStatusHandler(ctx(), req({ action: "archive", revision: 0 }), loop.id)).status, 200);
    assert.equal((await h.loopStatusHandler(ctx(), req({ action: "archive", revision: 1 }), loop.id)).status, 409, "already archived");
    const restored = await h.loopStatusHandler(ctx(), req({ action: "restore", revision: 1 }), loop.id);
    assert.equal((await restored.json()).status, "DRAFT", "never published, so back to draft");
  });

  test("two rounds with the same id are rejected", async () => {
    const loop = await prisma.loopTemplate.create({ data: { name: "Loop", organizationId: orgId } });
    const dup = { ...body(0), rounds: [body(0).rounds[0], body(0).rounds[0]] };
    const r = await h.updateLoopHandler(ctx(), req(dup), loop.id);
    assert.equal(r.status, 400);
    assert.match((await r.json()).error, /share an id/);
  });
});
