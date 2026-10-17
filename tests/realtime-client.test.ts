import assert from "node:assert/strict";
import test from "node:test";
import { looksUnfinished } from "../lib/realtimeClient";

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
