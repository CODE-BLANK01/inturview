import assert from "node:assert/strict";
import test from "node:test";
import { contactFor, deadlineText } from "../lib/applicant";

test("deadlines read in the company's timezone, with the zone named", () => {
  const at = new Date("2026-10-29T03:59:00Z");
  assert.equal(deadlineText(at, "America/New_York"), "Wednesday, October 28 at 11:59 PM EDT");
  assert.equal(deadlineText(at, "UTC"), "Thursday, October 29 at 3:59 AM UTC");
  // A bad stored zone falls back to UTC instead of crashing the page.
  assert.equal(deadlineText(at, "Not/AZone"), "Thursday, October 29 at 3:59 AM UTC");
});

test("applicants are pointed at the company's contact email when there is one", () => {
  const base = { name: "Acme", timezone: "UTC", logoUrl: null, website: null };
  assert.deepEqual(contactFor({ ...base, contactEmail: "talent@acme.test" }), { label: "talent@acme.test", href: "mailto:talent@acme.test" });
  assert.deepEqual(contactFor({ ...base, contactEmail: null }), { label: "the email your invitation came from", href: null });
  assert.equal(contactFor(null).href, null);
});
