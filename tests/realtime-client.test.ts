import assert from "node:assert/strict";
import test from "node:test";
import { heardPortion, looksUnfinished, textFromResponse } from "../lib/realtimeClient";

test("an interrupted reply keeps only the words that were played", () => {
  const reply = "Thanks for sharing that. Now let's talk about your compensation expectations.";
  // 15 chars/s for 2 s ≈ 30 characters, trimmed back to a whole word.
  assert.equal(heardPortion(reply, 2000, 0.015), "Thanks for sharing that. Now");
  // Never cuts mid-word or leaves trailing punctuation.
  assert.equal(heardPortion(reply, 1000, 0.015), "Thanks for");
  // Played past the end: the whole reply was heard.
  assert.equal(heardPortion(reply, 60_000, 0.015), reply);
  assert.equal(heardPortion(reply, 0, 0.015), "");
});

const textResponse = (text: string, status = "completed") => ({
  status,
  output: [{ type: "message", content: [{ type: "output_text", text }] }],
});

test("the interviewer's notes are read only from a completed response", () => {
  assert.equal(textFromResponse(textResponse("Notice period: 30 days.")), "Notice period: 30 days.");
  // A cut-off or failed notes request is treated as no notes, not partial notes.
  assert.equal(textFromResponse(textResponse("Background: AI eng", "incomplete")), null);
  assert.equal(textFromResponse(textResponse("Background:", "cancelled")), null);
  assert.equal(textFromResponse(textResponse("   ")), null);
  assert.equal(textFromResponse(undefined), null);
});

test("unfinished speech gets a longer response grace window", () => {
  assert.equal(looksUnfinished("I would put the cache in front of"), true);
  assert.equal(looksUnfinished("The next step is,"), true);
  assert.equal(looksUnfinished("I would shard by customer"), true);
});

test("complete and short replies do not receive extra delay", () => {
  assert.equal(looksUnfinished("I would shard by customer."), false);
  assert.equal(looksUnfinished("Consistent hashing"), false);
  assert.equal(looksUnfinished("Yes"), false);
});
