import assert from "node:assert/strict";
import test from "node:test";
import { summarizeRounds, type CompletedRound } from "../lib/dashboardSummary";

const round = (
  id: string,
  mode: string,
  totalScore: number | null,
  date: string | null,
): CompletedRound => ({
  id,
  mode,
  title: id,
  href: `/history/${id}`,
  totalScore,
  completedAt: date ? new Date(date) : null,
});

test("dashboard combines all modes, excludes unscored rounds from averages, and orders history", () => {
  const rows = [
    round("a", "Coding", 20, "2026-09-28T10:00:00Z"),
    round("b", "Recruiter screen", 15, "2026-09-29T10:00:00Z"),
    round("c", "Behavioral", null, "2026-09-29T12:00:00Z"),
    round("d", "System design", 25, "2026-09-30T01:00:00Z"),
    round("e", "Face-to-face", 0, "2026-09-30T02:00:00Z"),
  ];
  const data = summarizeRounds(rows, new Date("2026-09-30T15:00:00Z"));
  assert.equal(data.interviewsCompleted, 5);
  assert.equal(data.averageScore, 15);
  assert.equal(data.bestScore, 25);
  assert.equal(data.daysActive, 3);
  assert.deepEqual(
    data.recent.map((r) => r.id),
    ["e", "d", "c", "b", "a"],
  );
  assert.deepEqual(
    data.activity.map((d) => d.count),
    [0, 0, 0, 0, 1, 2, 2],
  );
  assert.equal(rows[0]?.id, "a");
});

test("activity uses seven UTC dates across month boundaries and ignores older completions", () => {
  const data = summarizeRounds(
    [
      round("old", "Coding", 10, "2026-08-25T23:59:59Z"),
      round("boundary", "Behavioral", 25, "2026-08-26T00:00:00Z"),
      round("today", "Recruiter screen", 20, "2026-09-01T00:00:00Z"),
    ],
    new Date("2026-09-01T04:00:00Z"),
  );
  assert.equal(data.activity[0]?.date, "2026-08-26");
  assert.equal(data.activity[6]?.date, "2026-09-01");
  assert.equal(
    data.activity.reduce((a, d) => a + d.count, 0),
    2,
  );
  assert.equal(data.daysActive, 3);
});

test("new candidates get honest empty states without invented scores or activity", () => {
  const data = summarizeRounds([], new Date("2026-09-30T12:00:00Z"));
  assert.equal(data.averageScore, null);
  assert.equal(data.bestScore, null);
  assert.equal(data.interviewsCompleted, 0);
  assert.equal(data.daysActive, 0);
  assert.equal(data.recent.length, 0);
  assert.equal(data.activity.length, 7);
  assert.ok(data.activity.every((day) => day.count === 0));
});
