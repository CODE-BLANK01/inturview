#!/usr/bin/env node
// Fails when a color is written anywhere except lib/theme.ts, so changing a
// color there changes it everywhere. Use a role instead:
//   CSS        rgb(var(--text-secondary))
//   Tailwind   text-text-muted, bg-bg-surface, bg-overlay/60
//   TS/HTML    inlineColors from lib/theme.ts (emails, the error page)
// A line that must keep a literal says why and ends with `color-literal-ok`.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["app", "components", "lib"];
const EXTS = [".ts", ".tsx", ".css"];
const SOURCE = join("lib", "theme.ts");

const RULES = [
  { name: "hex color", re: /(?<![\w&/])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b(?![\w-])/g },
  { name: "rgb()/hsl() literal", re: /\b(?:rgba?|hsla?)\(\s*\d/g },
  {
    name: "Tailwind palette color",
    re: /\b(?:bg|text|border|ring|ring-offset|from|via|to|fill|stroke|outline|divide|shadow|decoration|placeholder|accent|caret)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(?:-\d{2,3})?\b/g,
  },
  { name: "named color", re: /(?:^|[\s:;,(])(?:white|black)\s*[;)!,]/g, css: true },
];

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (EXTS.some((ext) => name.endsWith(ext)) && !name.includes(".test.")) out.push(path);
  }
  return out;
}

const problems = [];
for (const file of ROOTS.flatMap((r) => walk(r))) {
  if (file === SOURCE) continue;
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    if (line.includes("color-literal-ok")) return;
    for (const rule of RULES) {
      if (rule.css && !file.endsWith(".css")) continue;
      for (const m of line.matchAll(rule.re)) {
        problems.push(`${file}:${i + 1}  ${rule.name}: ${m[0].trim()}`);
      }
    }
  });
}

if (problems.length) {
  console.error(`Colors belong in ${SOURCE}. Use a role (see docs/design-system.md):\n`);
  for (const p of problems) console.error("  " + p);
  process.exit(1);
}
console.log("check:colors: every color comes from lib/theme.ts");
