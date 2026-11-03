import assert from "node:assert/strict";
import test from "node:test";
import { claudeCostUsd } from "../lib/aiCost";

test("Sonnet 4.5 turn is priced per token type", () => {
  // 2,000 fresh input + 10,000 cached read + 1,000 cache write + 500 output
  const { costUsd, priced } = claudeCostUsd("claude-sonnet-4-5", {
    input_tokens: 2_000,
    cache_read_input_tokens: 10_000,
    cache_creation_input_tokens: 1_000,
    output_tokens: 500,
  });
  // 2000×$3 + 10000×$0.30 + 1000×$3.75 + 500×$15, per million
  assert.equal(priced, true);
  assert.equal(costUsd, 0.02025);
});

test("dated model IDs match their family", () => {
  assert.equal(claudeCostUsd("claude-sonnet-4-5-20250929", { output_tokens: 1_000_000 }).costUsd, 15);
});

test("unknown models are flagged, not guessed", () => {
  assert.deepEqual(claudeCostUsd("claude-mystery-9", { input_tokens: 1_000 }), { costUsd: 0, priced: false });
});

test("missing usage fields count as zero", () => {
  assert.equal(claudeCostUsd("claude-sonnet-4-5", {}).costUsd, 0);
  assert.equal(claudeCostUsd("claude-sonnet-4-5", { input_tokens: null, output_tokens: 1_000 }).costUsd, 0.015);
});
