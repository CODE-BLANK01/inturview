import assert from "node:assert/strict";
import test from "node:test";
import { safeNext } from "../lib/nextPath";

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

test("auth pages are never a destination (no redirect loops)", () => {
  assert.equal(safeNext("/signin"), null);
  assert.equal(safeNext("/verify-email?token=x"), null);
  assert.equal(safeNext("/signup/anything"), null);
});
