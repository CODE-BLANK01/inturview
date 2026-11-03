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

test("deletion is due N months after the decision, or after the interview without one", async () => {
  const { deletionDue } = await import("../lib/applicantData");
  const base = { decidedAt: null, completedAt: null, expiresAt: null, createdAt: new Date("2026-01-10T00:00:00Z") };
  assert.equal(deletionDue({ ...base, decidedAt: new Date("2026-03-01T00:00:00Z") }, 12).toISOString(), "2027-03-01T00:00:00.000Z");
  assert.equal(deletionDue({ ...base, completedAt: new Date("2026-02-01T00:00:00Z") }, 6).toISOString(), "2026-08-01T00:00:00.000Z");
  assert.equal(deletionDue(base, 99).toISOString(), "2027-01-10T00:00:00.000Z", "never more than 12 months");
  assert.equal(deletionDue(base, 12, true).toISOString(), "2026-01-17T00:00:00.000Z", "previews: a week");
});
