import assert from "node:assert/strict";
import test from "node:test";
import {
  beginLoopRound,
  completeLoopRound,
  consistencyFindings,
  LoopInputSchema,
  quotaMessage,
  type InterviewLoop,
  type LoopQuotas,
} from "../lib/loop";
import { createMockLoopRepository } from "../lib/loopMock";

const loop: InterviewLoop = {
  id: "test",
  role: "Engineer",
  interviewDate: "2026-11-12",
  createdAt: "2026-10-05",
  notes: [],
  rounds: [
    {
      id: "r1",
      title: "Story",
      focus: "Ownership",
      mode: "recruiter",
      status: "available",
    },
    {
      id: "r2",
      title: "Decisions",
      focus: "Impact",
      mode: "behavioral",
      status: "locked",
    },
  ],
};
test("a locked round cannot start or finish, and completion unlocks exactly the next round", () => {
  assert.throws(() => beginLoopRound(loop, "r2"));
  assert.throws(() => completeLoopRound(loop, "r1", "An answer"));
  const running = beginLoopRound(loop, "r1");
  assert.throws(() => completeLoopRound(running, "r1", "   "));
  const completed = completeLoopRound(running, "r1", "I built this alone.");
  assert.deepEqual(
    completed.rounds.map((round) => round.status),
    ["complete", "available"],
  );
  assert.equal(completed.notes[0]?.quote, "I built this alone.");
  assert.equal(loop.rounds[0]?.status, "available");
});
test("consistency comparisons use verbatim answers from different rounds and avoid asserting a contradiction", () => {
  const first = completeLoopRound(
    beginLoopRound(loop, "r1"),
    "r1",
    "I built this alone.",
  );
  assert.equal(consistencyFindings(first).length, 0);
  const second = completeLoopRound(
    beginLoopRound(first, "r2"),
    "r2",
    "Our team delivered the project together.",
  );
  const finding = consistencyFindings(second)[0]!;
  assert.equal(finding.left.quote, "I built this alone.");
  assert.equal(finding.right.quote, "Our team delivered the project together.");
  assert.match(finding.coaching, /may describe different projects/);
});
test("plan caps handle zero, reached, available, and unlimited access", () => {
  const quotas: LoopQuotas = {
    recruiter: { used: 0, cap: 0 },
    behavioral: { used: 3, cap: 3 },
    coding: { used: 999, cap: null },
    design: { used: 1, cap: 2 },
  };
  assert.match(quotaMessage("recruiter", quotas)!, /0 of 0/);
  assert.match(quotaMessage("behavioral", quotas)!, /monthly reset/);
  assert.equal(quotaMessage("coding", quotas), null);
  assert.equal(quotaMessage("design", quotas), null);
});
test("the plan rejects impossible calendar dates", () => {
  const input = {
    jobPost: "Software engineer with distributed systems experience.",
    resume: "I built reliable systems for a small product team.",
    interviewDate: "2026-02-31",
  };
  assert.equal(LoopInputSchema.safeParse(input).success, false);
  assert.equal(
    LoopInputSchema.safeParse({ ...input, interviewDate: "2026-02-28" })
      .success,
    true,
  );
});
test("mock persistence isolates owners and rejects malformed stored data", async () => {
  const original = Object.getOwnPropertyDescriptor(
    globalThis,
    "sessionStorage",
  );
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: {
      setItem: (key: string, value: string) => values.set(key, value),
      getItem: (key: string) => values.get(key) ?? null,
    },
  });
  try {
    const first = createMockLoopRepository("candidate-one");
    const other = createMockLoopRepository("candidate-two");
    await first.save(loop);
    assert.equal((await first.get(loop.id))?.role, "Engineer");
    assert.equal(await other.get(loop.id), null);
    values.set("inturview:loop-preview:v1:candidate-one:test", '{"id":"test"}');
    assert.equal(await first.get("test"), null);
  } finally {
    if (original) Object.defineProperty(globalThis, "sessionStorage", original);
    else Reflect.deleteProperty(globalThis, "sessionStorage");
  }
});
