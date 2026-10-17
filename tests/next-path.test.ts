import assert from "node:assert/strict";
import test from "node:test";
import { afterVerify, safeNext } from "../lib/nextPath";

test("same-site paths are kept", () => {
  assert.equal(safeNext("/hire/join/abc123"), "/hire/join/abc123");
  assert.equal(safeNext("/dashboard?tab=history"), "/dashboard?tab=history");
});

test("anything that could leave the site is refused", () => {
  for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", "/javascript:alert(1)", "evil.com", "", "/\u0000x"]) {
    assert.equal(safeNext(bad), null, bad);
  }
  assert.equal(safeNext(undefined), null);
  assert.equal(safeNext("/" + "a".repeat(400)), null);
});

test("sign-in and sign-up are never a destination (no redirect loops)", () => {
  assert.equal(safeNext("/signin"), null);
  assert.equal(safeNext("/signup/anything"), null);
});

test("signing in from a verification link returns to it, but verifying never loops back", () => {
  assert.equal(safeNext("/verify-email?token=x&next=%2Fhire"), "/verify-email?token=x&next=%2Fhire");
  assert.equal(afterVerify("/verify-email?token=x"), null);
  assert.equal(afterVerify("/hire/join/abc"), "/hire/join/abc");
});

test("landing: people using both products go back to the one they used last", async () => {
  const { pickLanding, parseProduct } = await import("../lib/landingRule");
  const both = { practiceSetUp: true, inWorkspace: true };
  assert.equal(pickLanding({ ...both, last: "hire" }), "/hire");
  assert.equal(pickLanding({ ...both, last: "practice" }), "/dashboard");
  assert.equal(pickLanding({ ...both, last: null }), "/dashboard", "no signal: Practice, which they set up");
  assert.equal(pickLanding({ practiceSetUp: false, inWorkspace: true, last: null }), "/hire");
  assert.equal(pickLanding({ practiceSetUp: false, inWorkspace: true, last: "practice" }), "/hire", "no Practice set up: the workspace");
  assert.equal(pickLanding({ practiceSetUp: true, inWorkspace: false, last: "hire" }), "/dashboard", "left the workspace: Practice");
  assert.equal(pickLanding({ practiceSetUp: false, inWorkspace: false, last: null }), "/onboarding");
  assert.equal(parseProduct("hire"), "hire");
  assert.equal(parseProduct("anything else"), null);
});
