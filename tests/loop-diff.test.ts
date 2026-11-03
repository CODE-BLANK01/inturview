import assert from "node:assert/strict";
import test from "node:test";
import { diffLoop, type LoopShape } from "../lib/loopDiff";

const round = (id: string, title: string, minutes = 20) => ({
  id, category: "BEHAVIORAL" as const, title, durationMinutes: minutes, candidateBrief: "",
  questions: { mode: "pool" as const, count: 2, tags: [], roles: [], level: null },
});
const base: LoopShape = { name: "Backend screen", description: null, roleTarget: "Backend", level: "senior", rounds: [round("a", "How you work"), round("b", "Design", 30)] };

test("nothing published yet says so", () => {
  assert.deepEqual(diffLoop(null, base), ["First version: nothing has been published yet."]);
});

test("no changes, no list", () => {
  assert.deepEqual(diffLoop(base, structuredClone(base)), []);
});

test("added, removed, edited and reordered rounds are described", () => {
  const draft: LoopShape = {
    ...base,
    name: "Backend screen v2",
    rounds: [{ ...round("b", "System design", 45) }, round("c", "Coding", 40)],
  };
  const d = diffLoop(base, draft);
  assert.ok(d.includes('Renamed from "Backend screen" to "Backend screen v2".'));
  assert.ok(d.includes("Removed Round 1 (How you work)."));
  assert.ok(d.some((x) => x.startsWith("Round 1 (System design): renamed from \"Design\", 30 → 45 min")));
  assert.ok(d.includes("Added Round 2 (Coding): 40 min, 2 from a pool."));
});

test("question changes inside a round are caught", () => {
  const draft = structuredClone(base);
  draft.rounds[0]!.questions = { mode: "fixed", questionIds: ["q1", "q2", "q3"] };
  assert.deepEqual(diffLoop(base, draft), ["Round 1 (How you work): questions: 2 from a pool → 3 chosen questions."]);
  const reordered = { ...base, rounds: [base.rounds[1]!, base.rounds[0]!] };
  assert.deepEqual(diffLoop(base, reordered), ["Rounds reordered."]);
});
