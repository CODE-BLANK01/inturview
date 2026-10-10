#!/usr/bin/env node
// Reads the SQL that `prisma migrate diff` produced for a schema change and
// blocks statements that destroy data, unless the PR is explicitly labelled.
//
//   node scripts/schema-guard.mjs <diff.sql> [--allow-destructive]
//
// Writes a Markdown summary to stdout (CI posts it as a PR comment) and exits
// 1 when a destructive statement is present and not allowed.
import { readFileSync } from "node:fs";

const [file, flag] = process.argv.slice(2);
if (!file) {
  console.error("usage: schema-guard.mjs <diff.sql> [--allow-destructive]");
  process.exit(2);
}
const allow = flag === "--allow-destructive";
const sql = readFileSync(file, "utf8");

const RULES = [
  { re: /DROP TABLE/i, why: "drops a table and every row in it" },
  { re: /DROP COLUMN/i, why: "drops a column and its data" },
  { re: /DROP TYPE/i, why: "drops an enum type (usually an enum value being removed)" },
  { re: /_new"? AS ENUM/i, why: "rebuilds an enum; existing rows with a removed value make the migration fail" },
  { re: /ALTER COLUMN "[^"]+" (SET DATA )?TYPE/i, why: "changes a column type; values may not convert" },
  { re: /ALTER COLUMN "[^"]+" SET NOT NULL/i, why: "makes a column required; fails if existing rows are empty", warnOnly: true },
];

const statements = sql
  .split("\n")
  .filter((line) => line.trim() && !line.trim().startsWith("--"));
const hits = [];
for (const line of statements) {
  for (const rule of RULES) {
    if (rule.re.test(line)) hits.push({ line: line.trim(), ...rule });
  }
}
const blocking = hits.filter((hit) => !hit.warnOnly);
const empty = statements.length === 0 || /empty migration/i.test(sql);

const out = ["### Schema change", ""];
if (empty) {
  out.push("`schema.prisma` changed, but the database SQL is identical (comments or formatting only).");
} else {
  if (blocking.length && !allow) {
    out.push("**Blocked: this change destroys data.** Add the `allow-destructive-migration` label once you've confirmed nothing in use is lost.", "");
  } else if (blocking.length) {
    out.push("**Destructive change allowed by the `allow-destructive-migration` label.** Double-check before merging.", "");
  } else {
    out.push("Additive change only. Nothing existing is dropped or rewritten.", "");
  }
  for (const hit of hits) out.push(`- ${hit.warnOnly ? "⚠️" : "⛔"} \`${hit.line}\` ${hit.why}`);
  if (hits.length) out.push("");
  out.push("<details><summary>Full SQL</summary>", "", "```sql", sql.trim(), "```", "", "</details>");
}
console.log(out.join("\n"));
process.exit(blocking.length && !allow ? 1 : 0);
