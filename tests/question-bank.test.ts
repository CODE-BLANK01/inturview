import assert from "node:assert/strict";
import test from "node:test";
import { QuestionCategory } from "@prisma/client";
import { seedQuestions } from "../lib/questionSeed";
import { hasUnpublishedChanges, QuestionInputSchema, snapshotOf, type QuestionSnapshot } from "../lib/questionBank";
import { buildDraftPrompt, parseDrafts } from "../lib/questionDrafts";

test("every built-in question imports as a valid, uniquely keyed question", () => {
  const rows = seedQuestions();
  const keys = new Set(rows.map((r) => r.sourceKey));
  assert.equal(keys.size, rows.length, "sourceKeys must be unique");
  for (const r of rows) {
    const parsed = QuestionInputSchema.safeParse(r.input);
    assert.ok(parsed.success, `${r.sourceKey}: ${parsed.success ? "" : parsed.error.issues[0]?.message}`);
  }
  const by = (c: QuestionCategory) => rows.filter((r) => r.input.category === c).length;
  assert.ok(by(QuestionCategory.BEHAVIORAL) > 0 && by(QuestionCategory.TECHNICAL) > 0 && by(QuestionCategory.CODING) > 0);
});

test("coding imports are marked as externally sourced", () => {
  const coding = seedQuestions().filter((r) => r.input.category === QuestionCategory.CODING);
  assert.ok(coding.every((r) => r.input.tags.includes("external-leetcode")));
});

const base: QuestionSnapshot = {
  category: QuestionCategory.BEHAVIORAL,
  title: "Conflict",
  prompt: "Tell me about a disagreement.",
  followUps: ["What did you do?"],
  signals: ["Owns their part"],
  levels: [],
  roles: [],
  tags: ["conflict"],
  difficulty: null,
  details: null,
};

test("unpublished changes are detected only when content differs", () => {
  assert.equal(hasUnpublishedChanges(base, null), true, "never published");
  assert.equal(hasUnpublishedChanges({ ...base }, snapshotOf(base)), false);
  assert.equal(hasUnpublishedChanges({ ...base, prompt: "Edited" }, snapshotOf(base)), true);
  // Extra database columns on the live row must not count as changes.
  const live = { ...base, id: "q1", updatedAt: new Date() } as unknown as QuestionSnapshot;
  assert.equal(hasUnpublishedChanges(live, snapshotOf(base)), false);
});

const good = {
  category: "BEHAVIORAL",
  title: "Shipping under a deadline",
  prompt: "Tell me about a time you had to cut scope to hit a date.",
  followUps: ["What did you cut first?", "How did you tell stakeholders?"],
  signals: ["Names the trade-off explicitly", "Explains how they decided"],
  levels: ["mid"],
  roles: ["backend"],
  tags: ["prioritization"],
  difficulty: null,
  details: null,
};

test("drafts: valid questions pass, malformed ones are rejected with a reason", () => {
  const reply = `Here you go:\n${JSON.stringify([good, { ...good, title: "" }, { ...good, category: "CODING" }])}`;
  const { drafts, rejected } = parseDrafts(reply, [QuestionCategory.BEHAVIORAL]);
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0]!.title, "Shipping under a deadline");
  assert.equal(rejected.length, 2);
  assert.match(rejected[1]!.reason, /not requested/);
});

test("drafts: a reply without JSON produces no drafts", () => {
  assert.equal(parseDrafts("Sorry, I can't help with that.", [QuestionCategory.BEHAVIORAL]).drafts.length, 0);
  assert.equal(parseDrafts("[{oops", [QuestionCategory.BEHAVIORAL]).drafts.length, 0);
});

test("draft prompt asks for original questions and the requested categories only", () => {
  const { system, user } = buildDraftPrompt({
    jobDescription: "Senior backend engineer on payments",
    categories: [QuestionCategory.BEHAVIORAL, QuestionCategory.TECHNICAL],
    count: 4,
    level: "senior",
  });
  assert.match(system, /original/i);
  assert.match(system, /protected characteristics/);
  assert.match(system, /"BEHAVIORAL", "TECHNICAL"/);
  assert.match(user, /Write 4 questions/);
  assert.match(user, /payments/);
});
