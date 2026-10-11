#!/usr/bin/env node
// Writes a migration for your schema changes without touching any database.
//
//   npm run db:new-migration -- add_round_packs
//
// Diffs prisma/schema.prisma against the schema on origin/dev (or BASE_REF)
// and saves the SQL under prisma/migrations/<timestamp>_<name>/.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const name = (process.argv[2] ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
if (!name) {
  console.error("usage: npm run db:new-migration -- <short_name>");
  process.exit(2);
}
const baseRef = process.env.BASE_REF ?? "origin/dev";
const tmp = mkdtempSync(join(tmpdir(), "migration-"));
const basePath = join(tmp, "base.prisma");
writeFileSync(basePath, execFileSync("git", ["show", `${baseRef}:prisma/schema.prisma`]));

const sql = execFileSync(
  "npx",
  ["prisma", "migrate", "diff", "--from-schema-datamodel", basePath, "--to-schema-datamodel", "prisma/schema.prisma", "--script"],
  { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
);
if (!sql.trim() || /empty migration/i.test(sql)) {
  console.log(`No schema changes against ${baseRef}; nothing to write.`);
  process.exit(0);
}
const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
const dir = join("prisma", "migrations", `${stamp}_${name}`);
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, "migration.sql"), sql);
console.log(`Wrote ${dir}/migration.sql\nReview it, commit it with the schema change, and open a PR. CI checks it for destructive statements.`);
