#!/usr/bin/env node
// Fails when code reads an environment variable that the matching example
// file doesn't document. Catches "works locally, broken on Netlify".
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

// Set by the platform or the toolchain, never by us.
// NEXT_PUBLIC_RELEASE and NEXT_PUBLIC_DEPLOY_CONTEXT are filled in by next.config.js.
const PLATFORM = new Set([
  "NODE_ENV", "NEXT_RUNTIME", "CI", "PORT",
  "COMMIT_REF", "CONTEXT", "NEXT_PUBLIC_RELEASE", "NEXT_PUBLIC_DEPLOY_CONTEXT",
]);

function walk(dir, exts, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, exts, out);
    else if (exts.some((ext) => name.endsWith(ext))) out.push(path);
  }
  return out;
}

function documented(exampleFile) {
  return new Set(
    readFileSync(exampleFile, "utf8")
      .split("\n")
      .map((line) => line.match(/^\s*#?\s*([A-Z][A-Z0-9_]*)=/)?.[1])
      .filter(Boolean),
  );
}

function check(label, used, exampleFile) {
  const known = documented(exampleFile);
  const missing = [...used].filter((name) => !known.has(name) && !PLATFORM.has(name)).sort();
  if (missing.length === 0) {
    console.log(`✓ ${label}: all ${used.size} variables documented in ${exampleFile}`);
    return true;
  }
  console.error(`✗ ${label}: add these to ${exampleFile}:`);
  for (const name of missing) console.error(`    ${name}`);
  return false;
}

// Next.js app: process.env.NAME and process.env["NAME"].
const appFiles = [
  ...walk("app", [".ts", ".tsx"]),
  ...walk("lib", [".ts", ".tsx"]),
  ...walk("components", [".ts", ".tsx"]),
  ...["middleware.ts", "next.config.js", "instrumentation.ts", "sentry.client.config.ts", "sentry.server.config.ts", "sentry.edge.config.ts"].filter(existsSync),
];
const appUsed = new Set();
for (const file of appFiles) {
  for (const match of readFileSync(file, "utf8").matchAll(/process\.env(?:\.([A-Z][A-Z0-9_]*)|\[["']([A-Z][A-Z0-9_]*)["']\])/g)) {
    appUsed.add(match[1] ?? match[2]);
  }
}

// Realtime service: pydantic-settings fields map to upper-case env names.
const realtimeUsed = new Set();
const configPy = "services/realtime/app/config.py";
if (existsSync(configPy)) {
  for (const match of readFileSync(configPy, "utf8").matchAll(/^    ([a-z][a-z0-9_]*)\s*:/gm)) {
    if (match[1] !== "model_config") realtimeUsed.add(match[1].toUpperCase());
  }
}

const ok = [
  check("Next.js app", appUsed, ".env.local.example"),
  realtimeUsed.size === 0 || check("Realtime service", realtimeUsed, "services/realtime/.env.example"),
].every(Boolean);
process.exit(ok ? 0 : 1);
