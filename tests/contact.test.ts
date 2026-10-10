import assert from "node:assert/strict";
import test from "node:test";
import { ContactSchema } from "../lib/contact";

test("contact validation trims input and allows an optional name", () => {
  const value = ContactSchema.parse({
    name: "",
    email: "  reader@example.com ",
    message: "  I would like help with my interview.  ",
    topic: "support",
  });
  assert.equal(value.email, "reader@example.com");
  assert.equal(value.message, "I would like help with my interview.");
});
test("invalid and oversized contact messages produce field-level errors", () => {
  const result = ContactSchema.safeParse({
    name: "Person",
    email: "invalid",
    message: " ",
    topic: "support",
  });
  assert.equal(result.success, false);
  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    assert.ok(errors.email);
    assert.ok(errors.message);
  }
  assert.equal(
    ContactSchema.safeParse({
      name: "Person",
      email: "reader@example.com",
      message: "a".repeat(5001),
      topic: "support",
    }).success,
    false,
  );
});
