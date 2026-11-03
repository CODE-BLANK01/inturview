import assert from "node:assert/strict";
import test from "node:test";
import { can, canManageRole, PERMISSIONS } from "../lib/permissions";
import { isValidSlug, slugify } from "../lib/slug";
import { memberInviteEmail } from "../lib/workspaces";

test("owners can do everything", () => {
  for (const p of PERMISSIONS) assert.equal(can("OWNER", p), true, p);
});

test("the matrix matches the plan", () => {
  assert.equal(can("ADMIN", "workspace.billing"), false);
  assert.equal(can("ADMIN", "workspace.editProfile"), true);
  assert.equal(can("ADMIN", "members.manageAdmins"), false);
  assert.equal(can("RECRUITER", "members.manageStaff"), false);
  assert.equal(can("RECRUITER", "loops.edit"), true);
  assert.equal(can("RECRUITER", "applicantData.exportOrDelete"), false);
  assert.equal(can("REVIEWER", "applications.viewAll"), false);
  assert.equal(can("REVIEWER", "applications.decide"), false);
  assert.equal(can("REVIEWER", "applications.review"), true);
});

test("who can manage whom", () => {
  assert.equal(canManageRole("OWNER", "OWNER"), true);
  assert.equal(canManageRole("ADMIN", "RECRUITER"), true);
  assert.equal(canManageRole("ADMIN", "ADMIN"), false);
  assert.equal(canManageRole("ADMIN", "OWNER"), false);
  assert.equal(canManageRole("RECRUITER", "REVIEWER"), false);
});

test("slugs", () => {
  assert.equal(slugify("Acme Robotics, Inc."), "acme-robotics-inc");
  assert.equal(slugify("Café Société"), "cafe-societe");
  assert.equal(isValidSlug("acme"), true);
  for (const bad of ["new", "join", "-acme", "acme-", "Acme", "a".repeat(41), ""]) assert.equal(isValidSlug(bad), false, bad);
});

test("teammate invitation email escapes the company name and names the address", () => {
  const m = memberInviteEmail({
    to: "pat@acme.com",
    orgName: "<Acme>",
    role: "ADMIN",
    inviterName: "Sam",
    link: "https://inturview.com/hire/join/tok",
    expiresAt: new Date("2026-10-21T00:00:00Z"),
  });
  assert.match(m.text, /Sam invited you to join <Acme> on inturview Hire as a workspace admin\./);
  assert.match(m.html!, /&lt;Acme&gt;/);
  assert.doesNotMatch(m.html!, /<Acme>/);
  assert.match(m.text, /pat@acme\.com/);
  assert.match(m.text, /Wednesday, October 21/);
});
