import assert from "node:assert/strict";
import test from "node:test";
import { attentionReason, stageOf } from "../lib/candidateStage";

const r = (...statuses: ("IN_PROGRESS" | "SCORING" | "COMPLETED" | "SCORING_FAILED")[]) => statuses.map((status) => ({ status }));

test("invite statuses map to stages", () => {
  assert.equal(stageOf("PENDING", [], 2), "queued");
  assert.equal(stageOf("SENT", [], 2), "invited");
  assert.equal(stageOf("OPENED", [], 2), "opened");
  assert.equal(stageOf("REVOKED", r("COMPLETED"), 2), "cancelled");
  assert.equal(stageOf("COMPLETED", r("COMPLETED", "COMPLETED"), 2), "ready");
});

test("a started candidate moves through in progress, scoring and ready", () => {
  assert.equal(stageOf("STARTED", r("IN_PROGRESS"), 2), "in_progress");
  assert.equal(stageOf("STARTED", r("COMPLETED"), 2), "in_progress", "one of two rounds done");
  assert.equal(stageOf("STARTED", r("COMPLETED", "SCORING"), 2), "scoring");
  assert.equal(stageOf("STARTED", r("COMPLETED", "COMPLETED"), 2), "ready");
});

test("failed emails and failed scoring need attention, with a reason", () => {
  assert.equal(stageOf("FAILED", [], 1), "needs_attention");
  assert.equal(stageOf("STARTED", r("SCORING_FAILED", "IN_PROGRESS"), 2), "needs_attention");
  assert.match(attentionReason("FAILED", [])!, /didn't arrive/);
  assert.match(attentionReason("STARTED", r("SCORING_FAILED"))!, /re-score/);
  assert.equal(attentionReason("STARTED", r("COMPLETED")), null);
});
