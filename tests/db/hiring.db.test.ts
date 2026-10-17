import "./setup";
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import { QuestionCategory } from "@prisma/client";
import { prisma } from "../../lib/db";
import { createQuestion, publishQuestion } from "../../lib/questionBank";
import { publishLoop } from "../../lib/loopTemplates";
import * as h from "../../lib/hiring/handlers";
import type { HiringCtx } from "../../lib/hiring/handlers";

const run = randomBytes(4).toString("hex");
const req = (body?: unknown, url = "http://test.local/api") =>
  new NextRequest(url, body === undefined ? undefined : { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
const json = async (r: Response) => ({ status: r.status, body: (await r.json()) as Record<string, unknown> });

const question = (title: string) => ({
  category: QuestionCategory.BEHAVIORAL,
  title,
  prompt: "Tell me about a time you disagreed with a teammate and what happened.",
  followUps: [],
  signals: ["Owns the outcome"],
  levels: [],
  roles: [],
  tags: [`t${run}`],
  difficulty: null,
  details: null,
});
const fixedRound = (questionIds: string[]) => ({
  name: "Loop",
  description: null,
  roleTarget: null,
  level: null,
  rounds: [{ id: "r1", category: QuestionCategory.BEHAVIORAL, title: "Behavioral", durationMinutes: 20, candidateBrief: "", questions: { mode: "fixed", questionIds } }],
});

let A: HiringCtx, B: HiringCtx, platform: HiringCtx;
const ids = { platformQ: "", aQ: "", bQ: "", aLoop: "", bLoop: "", template: "", aCampaign: "", aInvite: "" };

before(async () => {
  const user = (who: string, role: "USER" | "ADMIN" = "USER") =>
    prisma.user.create({ data: { email: `${who}-${run}@example.test`, passwordHash: "x", role, emailVerifiedAt: new Date() }, select: { id: true } });
  const [ua, ub, op] = await Promise.all([user("a"), user("b"), user("op", "ADMIN")]);
  const [oa, ob] = await Promise.all([
    prisma.organization.create({ data: { name: `A ${run}`, slug: `a-${run}` } }),
    prisma.organization.create({ data: { name: `B ${run}`, slug: `b-${run}`, contactEmail: "talent@b.test" } }),
  ]);
  A = { organizationId: oa.id, actorId: ua.id };
  B = { organizationId: ob.id, actorId: ub.id };
  platform = { organizationId: null, actorId: op.id };

  const pq = await createQuestion(question(`Platform ${run}`), { createdById: op.id });
  await publishQuestion(pq.id, op.id);
  const bq = await createQuestion(question(`B secret ${run}`), { createdById: ub.id, organizationId: ob.id });
  await publishQuestion(bq.id, ub.id);
  ids.platformQ = pq.id;
  ids.bQ = bq.id;

  const tpl = await prisma.loopTemplate.create({ data: { ...fixedRound([pq.id]), name: `Template ${run}` } });
  await publishLoop(tpl.id, op.id);
  ids.template = tpl.id;
  const bl = await prisma.loopTemplate.create({ data: { ...fixedRound([bq.id]), name: `B loop ${run}`, organizationId: ob.id } });
  await publishLoop(bl.id, ub.id);
  ids.bLoop = bl.id;
});

after(async () => {
  await prisma.auditLog.deleteMany({ where: { adminId: { in: [A.actorId, B.actorId, platform.actorId] } } });
  await prisma.organization.deleteMany({ where: { id: { in: [A.organizationId!, B.organizationId!] } } });
  await prisma.loopTemplate.deleteMany({ where: { id: ids.template } });
  await prisma.question.deleteMany({ where: { id: ids.platformQ } });
  await prisma.user.deleteMany({ where: { email: { endsWith: `-${run}@example.test` } } });
  await prisma.$disconnect();
});

describe("questions stay inside their workspace", () => {
  test("A's new question belongs to A, and B can't read, edit or publish it", async () => {
    const created = await json(await h.createQuestionHandler(A, req(question(`A own ${run}`))));
    assert.equal(created.status, 201);
    ids.aQ = String(created.body.id);
    assert.equal((await prisma.question.findUniqueOrThrow({ where: { id: ids.aQ } })).organizationId, A.organizationId);

    assert.equal((await h.getQuestion(B, ids.aQ)).status, 404);
    assert.equal((await h.updateQuestionHandler(B, req(question("Hijacked")), ids.aQ)).status, 404);
    assert.equal((await h.questionStatusHandler(B, req({ action: "publish" }), ids.aQ)).status, 404);
    // Operators editing the library can't reach into a workspace either.
    assert.equal((await h.updateQuestionHandler(platform, req(question("Hijacked")), ids.aQ)).status, 404);
    assert.equal((await prisma.question.findUniqueOrThrow({ where: { id: ids.aQ } })).title, `A own ${run}`);
    assert.equal((await h.questionStatusHandler(A, req({ action: "publish" }), ids.aQ)).status, 200);
  });

  test("a workspace can't edit the inturview library", async () => {
    assert.equal((await h.updateQuestionHandler(A, req(question("Hijacked")), ids.platformQ)).status, 404);
  });

  test("the loop builder's picker offers own + library questions, never another workspace's", async () => {
    const r = await json(await h.listQuestions(A, req(undefined, `http://test.local/api?usable=1&q=${run}`)));
    const titles = (r.body.questions as { title: string; library: boolean }[]).map((q) => [q.title, q.library]);
    assert.deepEqual(titles.sort(), [[`A own ${run}`, false], [`Platform ${run}`, true]]);
    const own = await json(await h.listQuestions(B, req(undefined, `http://test.local/api?q=${run}`)));
    assert.deepEqual((own.body.questions as { title: string }[]).map((q) => q.title), [`B secret ${run}`]);
  });
});

describe("loops", () => {
  test("a loop can use library questions but not another workspace's", async () => {
    const created = await json(await h.createLoopHandler(A, req({ name: "A loop" })));
    ids.aLoop = String(created.body.id);
    const withB = await json(await h.updateLoopHandler(A, req({ ...fixedRound([ids.bQ]), revision: 0 }), ids.aLoop));
    assert.match(String((withB.body.problems as string[])[0]), /no longer exists/);
    assert.equal((await h.loopStatusHandler(A, req({ action: "publish", revision: 1 }), ids.aLoop)).status, 409);

    const ok = await json(await h.updateLoopHandler(A, req({ ...fixedRound([ids.platformQ, ids.aQ]), revision: 1 }), ids.aLoop));
    assert.deepEqual(ok.body.problems, []);
    assert.equal((await h.loopStatusHandler(A, req({ action: "publish", revision: 2 }), ids.aLoop)).status, 200);
  });

  test("pools count own + library questions only", async () => {
    const pool = { category: QuestionCategory.BEHAVIORAL, tags: [`t${run}`], roles: [], level: null };
    assert.equal((await json(await h.poolPreviewHandler(A, req(pool)))).body.count, 2); // A's + platform
    assert.equal((await json(await h.poolPreviewHandler(B, req(pool)))).body.count, 2); // B's + platform
    assert.equal((await json(await h.poolPreviewHandler(platform, req(pool)))).body.count, 1);
  });

  test("B can't edit, publish or archive A's loop", async () => {
    assert.equal((await h.updateLoopHandler(B, req({ ...fixedRound([ids.bQ]), revision: 3 }), ids.aLoop)).status, 404);
    assert.equal((await h.loopStatusHandler(B, req({ action: "archive", revision: 3 }), ids.aLoop)).status, 404);
  });

  test("templates copy into a workspace; another workspace's loop isn't a template", async () => {
    const copy = await json(await h.createLoopHandler(A, req({ fromTemplateId: ids.template })));
    assert.equal(copy.status, 201);
    const row = await prisma.loopTemplate.findUniqueOrThrow({ where: { id: String(copy.body.id) } });
    assert.equal(row.organizationId, A.organizationId);
    assert.equal(row.status, "DRAFT");
    assert.equal((await h.createLoopHandler(A, req({ fromTemplateId: ids.bLoop }))).status, 404);
  });
});

describe("invites", () => {
  test("B can't invite against A's loop", async () => {
    const r = await h.createCampaignHandler(B, req({ loopTemplateId: ids.aLoop, name: "Steal", recipients: [{ email: "x@y.test", name: null }] }));
    assert.equal(r.status, 404);
  });

  test("A's campaign belongs to A; B can't add to it, send it, or act on its invites", async () => {
    const created = await json(await h.createCampaignHandler(A, req({ loopTemplateId: ids.aLoop, name: "Batch", recipients: [{ email: `cand-${run}@example.test`, name: "Cand" }] })));
    assert.equal(created.status, 201);
    ids.aCampaign = String(created.body.id);
    assert.equal((await prisma.campaign.findUniqueOrThrow({ where: { id: ids.aCampaign } })).organizationId, A.organizationId);
    ids.aInvite = (await prisma.invite.findFirstOrThrow({ where: { campaignId: ids.aCampaign } })).id;

    assert.equal((await h.addRecipientsHandler(B, req({ recipients: [{ email: "z@y.test", name: null }] }), ids.aCampaign)).status, 404);
    assert.equal((await h.sendBatchHandler(B, req({}), ids.aCampaign)).status, 404);
    assert.equal((await h.inviteActionHandler(B, req({ action: "revoke" }), ids.aInvite)).status, 404);
    assert.equal((await prisma.invite.findUniqueOrThrow({ where: { id: ids.aInvite } })).status, "PENDING");
    // Admin's legacy view has no reach into workspaces.
    assert.equal((await h.inviteActionHandler(platform, req({ action: "revoke" }), ids.aInvite)).status, 404);
  });

  test("sending marks A's invites sent", async () => {
    const r = await json(await h.sendBatchHandler(A, req({}), ids.aCampaign));
    assert.equal(r.body.sent, 1);
  });

  test("B can't re-score A's rounds", async () => {
    const lr = await prisma.loopRun.create({ data: { inviteId: ids.aInvite, loopTemplateId: ids.aLoop, loopVersion: 1 } });
    const rr = await prisma.loopRoundRun.create({ data: { runId: lr.id, roundIndex: 0, roundId: "r1", category: QuestionCategory.BEHAVIORAL, questions: [], status: "SCORING" } });
    assert.equal((await h.rescoreHandler(B, rr.id)).status, 404);
  });
});
