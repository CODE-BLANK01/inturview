import "./setup";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import { QuestionCategory } from "@prisma/client";
import { prisma } from "../../lib/db";
import { createQuestion, publishQuestion } from "../../lib/questionBank";
import * as h from "../../lib/hiring/handlers";
import { listCandidates } from "../../lib/hiring/candidates";
import { loadLoopContext, startRound } from "../../lib/loopRuns";
import { recordConsent, findInviteByToken } from "../../lib/invites";

const run = randomBytes(4).toString("hex");
const req = (body: unknown) => new NextRequest("http://test.local/api", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
let A: h.HiringCtx, B: h.HiringCtx;
let qid = "";

const loopBody = (questionIds: string[], revision: number) => ({
  name: "Draft loop", description: null, roleTarget: null, level: null, revision,
  rounds: [{ id: "r1", category: "BEHAVIORAL", title: "How you work", durationMinutes: 20, candidateBrief: "", questions: { mode: "fixed", questionIds } }],
});

before(async () => {
  const [ua, ub] = await Promise.all(["a", "b"].map((w) => prisma.user.create({ data: { email: `${w}-${run}@example.test`, name: `User ${w}`, passwordHash: "x" } })));
  const [oa, ob] = await Promise.all(["a", "b"].map((w) => prisma.organization.create({ data: { name: `${w} ${run}`, slug: `pv-${w}-${run}` } })));
  A = { organizationId: oa!.id, actorId: ua!.id, canViewAll: true };
  B = { organizationId: ob!.id, actorId: ub!.id, canViewAll: true };
  qid = (await createQuestion({ category: QuestionCategory.BEHAVIORAL, title: "Q", prompt: "Tell me about a hard trade-off you made.", followUps: [], signals: [], levels: [], roles: [], tags: [], difficulty: null, details: null }, { organizationId: oa!.id })).id;
  await publishQuestion(qid, null);
});

after(async () => {
  await prisma.auditLog.deleteMany({ where: { adminId: { in: [A.actorId, B.actorId] } } });
  await prisma.organization.deleteMany({ where: { id: { in: [A.organizationId!, B.organizationId!] } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: `-${run}@example.test` } } });
  await prisma.$disconnect();
});

test("an unpublished draft can be previewed end to end, and the preview stays out of candidate lists", async () => {
  const loopId = String((await (await h.createLoopHandler(A, req({ name: "Draft loop" }))).json()).id);
  assert.equal((await h.updateLoopHandler(A, req(loopBody([qid], 0)), loopId)).status, 200);

  const res = await h.previewLoopHandler(A, req({ revision: 1 }), loopId);
  assert.equal(res.status, 201);
  const raw = String((await res.json()).link).replace("/i/", "");
  const found = await findInviteByToken(raw);
  assert.ok(found.ok);
  assert.equal(found.invite.campaign.preview, true);
  assert.equal(found.invite.email, `a-${run}@example.test`, "the preview is for the person who asked");

  await recordConsent(found.invite.id);
  const ctx = await loadLoopContext(raw);
  assert.equal(ctx.loop.rounds[0]!.title, "How you work", "runs the draft, though nothing is published");
  const { roundRun } = await startRound(ctx, 0);
  assert.equal((roundRun.questions as { questionId: string }[])[0]!.questionId, qid);

  assert.deepEqual(await listCandidates(A.organizationId!), [], "not a candidate");
  assert.equal(await prisma.delivery.count({ where: { inviteId: found.invite.id } }), 0, "never emailed");
});

test("a preview must match the editor's revision, be ready, and belong to the workspace", async () => {
  const loopId = String((await (await h.createLoopHandler(A, req({ name: "Empty" }))).json()).id);
  const stale = await h.previewLoopHandler(A, req({ revision: 5 }), loopId);
  assert.equal(stale.status, 409);
  assert.equal((await stale.json()).conflict, true);
  const notReady = await h.previewLoopHandler(A, req({ revision: 0 }), loopId);
  assert.equal(notReady.status, 409);
  assert.match((await notReady.json()).error, /Add at least one round/);
  assert.equal((await h.previewLoopHandler(B, req({ revision: 0 }), loopId)).status, 404);
});
