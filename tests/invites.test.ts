import assert from "node:assert/strict";
import test from "node:test";
import { funnelFrom } from "../lib/campaignStats";
import { hashInviteToken, inviteEmail, inviteExpiry, newInviteToken } from "../lib/invites";

test("links last 14 days, or until an earlier deadline", () => {
  const sent = new Date("2026-10-14T12:00:00Z");
  assert.equal(inviteExpiry(sent, null).toISOString(), "2026-10-28T12:00:00.000Z");
  assert.equal(inviteExpiry(sent, new Date("2026-10-20T23:59:59Z")).toISOString(), "2026-10-20T23:59:59.000Z");
  assert.equal(inviteExpiry(sent, new Date("2026-12-01T00:00:00Z")).toISOString(), "2026-10-28T12:00:00.000Z");
});

test("tokens are random and only their hash is comparable", () => {
  const a = newInviteToken();
  const b = newInviteToken();
  assert.notEqual(a.raw, b.raw);
  assert.ok(a.raw.length >= 40);
  assert.equal(a.hash, hashInviteToken(a.raw));
  assert.notEqual(a.hash, a.raw);
});

const base = {
  to: "ada@example.com",
  name: "Ada Lovelace",
  loopName: "Senior backend · payments",
  rounds: 2,
  minutes: 50,
  message: null,
  link: "https://inturview.com/i/abc123",
  expiresAt: new Date("2026-10-28T12:00:00Z"),
};

test("the invite email says what, how long, until when, and how to ask for adjustments", () => {
  const e = inviteEmail(base);
  assert.equal(e.subject, "You're invited: Senior backend · payments");
  assert.match(e.text, /^Hi Ada,/);
  assert.match(e.text, /2 rounds, about 50 minutes/);
  assert.match(e.text, /https:\/\/inturview\.com\/i\/abc123/);
  assert.match(e.text, /works until Wednesday, October 28/);
  assert.match(e.text, /adjustment/);
  assert.equal(e.replyTo, "hello@inturview.com");
});

test("names, messages and loop names are escaped in the HTML email", () => {
  const e = inviteEmail({ ...base, name: "<script>x</script>", loopName: 'A & B "loop"', message: "Line 1\n<b>bold</b>" });
  assert.ok(!e.html!.includes("<script>"));
  assert.ok(e.html!.includes("&lt;script&gt;"));
  assert.ok(e.html!.includes("A &amp; B &quot;loop&quot;"));
  assert.ok(e.html!.includes("&lt;b&gt;bold&lt;/b&gt;"));
  assert.ok(e.html!.includes("Line 1<br>"));
});

test("funnel is cumulative: a finished candidate also opened and started", () => {
  const f = funnelFrom({ SENT: 5, OPENED: 3, STARTED: 2, COMPLETED: 4, FAILED: 1, PENDING: 2, REVOKED: 1 });
  assert.deepEqual(f, { invited: 18, sent: 14, opened: 9, started: 6, completed: 4, pending: 2, failed: 1, revoked: 1 });
});

test("a company's invitation signs off as the company", async () => {
  const { inviteEmail } = await import("../lib/invites");
  const e = inviteEmail({ to: "a@b.test", name: null, loopName: "L", rounds: 1, minutes: 20, message: null, link: "https://x/i/t", expiresAt: new Date("2026-10-30T00:00:00Z"), company: "Acme & Co" });
  assert.match(e.text, /— The Acme & Co hiring team, via inturview$/);
  assert.match(e.html!, /The Acme &amp; Co hiring team/);
});
