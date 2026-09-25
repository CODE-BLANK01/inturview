import assert from "node:assert/strict";
import test from "node:test";
import { PlanTier } from "@prisma/client";
import { cachedInterviewPrompt } from "../lib/anthropic";
import { captureProductEvent } from "../lib/analytics";
import {
  CANDIDATE_PLANS,
  PLANS,
  getEffectivePlan,
  priceLabel,
  priceSuffix,
  renderFeature,
} from "../lib/plans";

test("unlimited access preserves the stored plan and displayed price", () => {
  const plan = getEffectivePlan(PlanTier.FREE, " ABDULLAHBASARVI@GMAIL.COM ");
  assert.equal(plan.tier, PlanTier.FREE);
  assert.equal(priceLabel(plan), "$0");
  assert.equal(plan.interviewsPerMonth, null);
  assert.equal(plan.designSessionsPerMonth, null);
  assert.equal(plan.behavioralSessionsPerMonth, null);
  assert.equal(plan.recruiterSessionsPerMonth, null);
  assert.equal(plan.faceToFaceSessionsPerMonth, null);
  assert.equal(renderFeature("{{interviews}} coding and {{designSessions}} design", plan), "unlimited coding and unlimited design");
});

test("candidate pricing stays separate from employer screening", () => {
  assert.deepEqual(CANDIDATE_PLANS.map((plan) => plan.tier), [PlanTier.FREE, PlanTier.PRO]);
  assert.ok(CANDIDATE_PLANS.every((plan) => plan.audience === "candidate"));

  const sprint = CANDIDATE_PLANS.find((plan) => plan.tier === PlanTier.PRO);
  assert.equal(sprint?.name, "Interview Sprint");
  assert.equal(priceLabel(sprint!), "$19");
  assert.equal(priceSuffix(sprint!), " / 30 days");

  const employerPlans = PLANS.filter((plan) => plan.audience === "employer");
  assert.equal(employerPlans.length, 3);
  assert.ok(employerPlans.every((plan) => !plan.name.toLowerCase().includes("team")));
});

test("cache markers stay on stable prompt content before changing live context", () => {
  const firstTurns = [
    { role: "user" as const, content: "My approach is a hash map." },
    { role: "assistant" as const, content: "What about duplicates?" },
    { role: "user" as const, content: "I would check before inserting." },
  ];
  const first = cachedInterviewPrompt("Stable interviewer instructions", firstTurns, "Code version one");
  const next = cachedInterviewPrompt(
    "Stable interviewer instructions",
    [...firstTurns, { role: "assistant", content: "Good. Continue." } as const, { role: "user", content: "Can I use a map?" } as const],
    "Code version two"
  );

  assert.deepEqual(first.system, next.system);
  assert.equal((first.messages[2]?.content as Array<{ text: string }>)[0]?.text,
    (next.messages[2]?.content as Array<{ text: string }>)[0]?.text);
  assert.equal((first.messages[2]?.content as Array<{ cache_control?: { type: string } }>)[0]?.cache_control?.type, "ephemeral");
  assert.match(JSON.stringify(first.messages.at(-1)?.content), /Code version one/);
  assert.match(JSON.stringify(next.messages.at(-1)?.content), /Code version two/);
  assert.ok(!JSON.stringify(next.messages.slice(0, -1)).includes("Code version one"));
});

test("server capture sends only the selected product event fields", async () => {
  const previousToken = process.env.POSTHOG_PROJECT_TOKEN;
  const previousFetch = globalThis.fetch;
  process.env.POSTHOG_PROJECT_TOKEN = "test-project-token";
  let captured: Record<string, unknown> | undefined;
  globalThis.fetch = async (_input, init) => {
    captured = JSON.parse(String(init?.body));
    return new Response("{}", { status: 200 });
  };
  try {
    const sent = await captureProductEvent("user-123", {
      event: "interview_started",
      properties: { mode: "recruiter_screen", session_id: "session-456" },
    });
    assert.equal(sent, true);
    assert.deepEqual(captured, {
      api_key: "test-project-token",
      distinct_id: "user-123",
      event: "interview_started",
      properties: { $process_person_profile: false, mode: "recruiter_screen", session_id: "session-456" },
    });
  } finally {
    globalThis.fetch = previousFetch;
    if (previousToken === undefined) delete process.env.POSTHOG_PROJECT_TOKEN;
    else process.env.POSTHOG_PROJECT_TOKEN = previousToken;
  }
});
