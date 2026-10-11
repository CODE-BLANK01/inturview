import assert from "node:assert/strict";
import test from "node:test";
import { buildDigest, type DigestData } from "../scripts/digest";

const base: DigestData = {
  repo: "CODE-BLANK01/inturview",
  since: new Date("2026-10-03T13:00:00Z"),
  until: new Date("2026-10-10T13:00:00Z"),
  merged: [
    { number: 41, title: "Add CI", author: "CODE-BLANK01", base: "dev", createdAt: "2026-10-05T10:00:00Z", mergedAt: "2026-10-05T16:00:00Z", url: "u41" },
    { number: 42, title: "Avatar retries", author: "AMMS46", base: "dev", createdAt: "2026-10-06T10:00:00Z", mergedAt: "2026-10-07T10:00:00Z", url: "u42" },
    { number: 43, title: "Release", author: "CODE-BLANK01", base: "main", createdAt: "2026-10-08T10:00:00Z", mergedAt: "2026-10-08T12:00:00Z", url: "u43" },
  ],
  open: [{ number: 44, title: "Round packs", author: "AMMS46", base: "dev", createdAt: "2026-10-08T13:00:00Z", url: "u44" }],
  issuesOpened: 3,
  issuesClosed: 2,
  schemaCommits: [{ sha: "abcdef1234", message: "Add RoundPack", author: "AMMS46" }],
  envCommits: [],
  ci: { runs: 10, failures: 1 },
};

const field = (embed: { fields?: { name: string; value: string }[] }, name: string) =>
  embed.fields?.find((f) => f.name === name)?.value;

test("digest groups shipped work by person, busiest first", () => {
  const [eng] = buildDigest(base);
  const shipped = field(eng, "Shipped")!;
  assert.ok(shipped.indexOf("CODE-BLANK01") < shipped.indexOf("AMMS46"));
  assert.match(shipped, /\*\*CODE-BLANK01\*\* · 2/);
  assert.match(shipped, /\[#42\]\(u42\) Avatar retries/);
});

test("digest reports releases, median merge time, CI and risky changes", () => {
  const [eng] = buildDigest(base);
  assert.equal(field(eng, "Releases to main"), "1");
  assert.equal(field(eng, "Median time to merge"), "6h");
  assert.equal(field(eng, "CI on dev/main"), "1 failed of 10");
  assert.match(field(eng, "Needs attention")!, /schema · `abcdef1` Add RoundPack \(AMMS46\)/);
  assert.match(field(eng, "Open pull requests")!, /#44.*2\.0d old/);
});

test("digest handles a quiet week", () => {
  const [eng] = buildDigest({ ...base, merged: [], open: [], schemaCommits: [], ci: { runs: 0, failures: 0 } });
  assert.equal(field(eng, "Shipped"), "Nothing merged this week.");
  assert.equal(field(eng, "Median time to merge"), "—");
  assert.equal(field(eng, "CI on dev/main"), "No runs");
});

test("product numbers include completion rate and cost per finished round", () => {
  const embeds = buildDigest({
    ...base,
    product: {
      signups: 12,
      started: 20,
      completed: 15,
      purchases: 2,
      costByCategory: [{ category: "behavioral", costUsd: 4.5, rounds: 9 }],
    },
  });
  assert.equal(embeds.length, 2);
  assert.equal(field(embeds[1], "Rounds finished"), "15 (75%)");
  assert.match(field(embeds[1], "Cost per finished round")!, /behavioral: \$0\.50\/round · 9 rounds/);
  assert.ok(embeds[1].footer && !embeds[0].footer);
});
