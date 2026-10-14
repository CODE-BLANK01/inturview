import assert from "node:assert/strict";
import test from "node:test";
import { MAX_RECIPIENTS, parseRecipients } from "../lib/recipients";

test("Google Sheets paste: tab-separated name and email with a header", () => {
  const r = parseRecipients("Name\tEmail\nAda Lovelace\tada@example.com\nAlan Turing\tALAN@example.com\n");
  assert.deepEqual(r.recipients, [
    { email: "ada@example.com", name: "Ada Lovelace" },
    { email: "alan@example.com", name: "Alan Turing" },
  ]);
  assert.equal(r.invalid.length, 0);
});

test("Sheets with first and last name in separate columns", () => {
  const r = parseRecipients("First name\tLast name\tEmail\nGrace\tHopper\tgrace@navy.mil");
  assert.deepEqual(r.recipients, [{ email: "grace@navy.mil", name: "Grace Hopper" }]);
});

test("CSV with quotes and the email first", () => {
  const r = parseRecipients('email,name\n"linus@example.com","Torvalds, Linus"\nmargaret@example.com,Margaret Hamilton');
  assert.deepEqual(r.recipients, [
    { email: "linus@example.com", name: "Torvalds, Linus" },
    { email: "margaret@example.com", name: "Margaret Hamilton" },
  ]);
});

test("plain emails, one line or many, and Name <email>", () => {
  assert.equal(parseRecipients("a@x.com, b@y.org; c@z.io").recipients.length, 3);
  const r = parseRecipients('Barbara Liskov <barbara@mit.edu>\n"Ken Thompson" <ken@bell.com>\nplain@example.com');
  assert.deepEqual(r.recipients.map((x) => x.name), ["Barbara Liskov", "Ken Thompson", null]);
});

test("bad rows are reported with their line number, duplicates are counted once", () => {
  const r = parseRecipients("ok@example.com\nnot an email\nbroken@\nOK@example.com\n\n");
  assert.equal(r.recipients.length, 1);
  assert.equal(r.duplicates, 1);
  assert.deepEqual(r.invalid.map((i) => [i.line, i.reason]), [[2, "No email found"], [3, "Not a valid email"]]);
});

test("lists over the limit are truncated, not silently accepted", () => {
  const text = Array.from({ length: MAX_RECIPIENTS + 5 }, (_, i) => `p${i}@example.com`).join("\n");
  const r = parseRecipients(text);
  assert.equal(r.recipients.length, MAX_RECIPIENTS);
  assert.equal(r.truncated, true);
});
