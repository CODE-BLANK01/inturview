import assert from "node:assert/strict";
import test from "node:test";
import { QuestionCategory, QuestionStatus } from "@prisma/client";
import { estimateLoopCost, totalMinutes } from "../lib/loopEstimate";
import { LoopEditSchema, parseRounds, poolWhere, readinessProblems, type LoopRoundConfig } from "../lib/loopTemplates";

const behavioralPool: LoopRoundConfig = {
  id: "r1",
  category: QuestionCategory.BEHAVIORAL,
  title: "Behavioral",
  durationMinutes: 20,
  candidateBrief: "",
  questions: { mode: "pool", count: 2, tags: [], roles: [], level: null },
};
const technicalFixed: LoopRoundConfig = {
  id: "r2",
  category: QuestionCategory.TECHNICAL,
  title: "Deep-dive",
  durationMinutes: 30,
  candidateBrief: "",
  questions: { mode: "fixed", questionIds: ["q1", "q2"] },
};
const facts = (fixed: [string, QuestionCategory, QuestionStatus][], pools: [string, number][] = []) => ({
  fixed: new Map(fixed.map(([id, category, status]) => [id, { category, status }])),
  poolSizes: new Map(pools),
});

test("a loop with good rounds is ready", () => {
  const f = facts([["q1", "TECHNICAL", "PUBLISHED"], ["q2", "TECHNICAL", "PUBLISHED"]], [["r1", 8]]);
  assert.deepEqual(readinessProblems([behavioralPool, technicalFixed], f), []);
});

test("readiness names every blocker in plain words", () => {
  assert.deepEqual(readinessProblems([], facts([])), ["Add at least one round."]);
  const p = readinessProblems(
    [behavioralPool, technicalFixed],
    facts([["q1", "TECHNICAL", "DRAFT"], ["q2", "CODING", "PUBLISHED"]], [["r1", 1]]),
  );
  assert.equal(p.length, 3);
  assert.match(p[0]!, /Round 1 \(Behavioral\) needs 2 matching questions but only 1 are published/);
  assert.match(p[1]!, /isn't published/);
  assert.match(p[2]!, /coding question in a technical deep-dive round/);
  assert.match(readinessProblems([technicalFixed], facts([["q1", "TECHNICAL", "PUBLISHED"]]))[0]!, /no longer exists/);
});

test("loops over four hours are blocked", () => {
  const long = Array.from({ length: 3 }, (_, i) => ({ ...behavioralPool, id: `r${i}`, durationMinutes: 90 }));
  const p = readinessProblems(long, facts([], long.map((r) => [r.id, 10])));
  assert.ok(p.some((x) => /over 4 hours/.test(x)));
});

test("cost estimate: per-minute live rates plus scoring per round", () => {
  const rates = { voice: 0.075, avatar: 0.1 };
  const est = estimateLoopCost([behavioralPool, technicalFixed], rates);
  assert.deepEqual(est.perRound, [{ id: "r1", usd: 3.55 }, { id: "r2", usd: 5.3 }]); // 20×0.175+0.05, 30×0.175+0.05
  assert.equal(est.totalUsd, 8.85);
  assert.equal(totalMinutes([behavioralPool, technicalFixed]), 50);
});

test("saved rounds are validated; corrupt data loads as empty, not a crash", () => {
  assert.equal(LoopEditSchema.safeParse({ name: "X", rounds: [{ ...behavioralPool, durationMinutes: 500 }] }).success, false);
  assert.equal(LoopEditSchema.safeParse({ name: "Senior backend", rounds: [behavioralPool, technicalFixed] }).success, true);
  assert.deepEqual(parseRounds([{ nonsense: true }]), []);
  assert.equal(parseRounds([behavioralPool]).length, 1);
});

test("pool matching treats untagged levels and roles as 'any'", () => {
  const w = poolWhere(QuestionCategory.TECHNICAL, { tags: ["kafka"], roles: ["backend"], level: "senior" });
  assert.equal(w.status, "PUBLISHED");
  assert.deepEqual(w.tags, { hasEvery: ["kafka"] });
  assert.deepEqual(w.OR, [{ levels: { has: "senior" } }, { levels: { isEmpty: true } }]);
  assert.deepEqual(w.AND, [{ OR: [{ roles: { hasSome: ["backend"] } }, { roles: { isEmpty: true } }] }]);
  assert.equal(poolWhere(QuestionCategory.TECHNICAL, { tags: [], roles: [], level: null }).OR, undefined);
});

test("snapshot comparison ignores key order, as Postgres reorders stored JSON", async () => {
  const { stableStringify } = await import("../lib/loopTemplates");
  assert.equal(stableStringify({ b: 1, a: { d: [1, { y: 2, x: 1 }], c: null } }), stableStringify({ a: { c: null, d: [1, { x: 1, y: 2 }] }, b: 1 }));
  assert.notEqual(stableStringify({ a: 1 }), stableStringify({ a: 2 }));
  assert.equal(stableStringify({ a: undefined, b: 1 }), stableStringify({ b: 1 }));
});
