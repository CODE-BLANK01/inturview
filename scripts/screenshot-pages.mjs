#!/usr/bin/env node
// Screenshots the public pages in light/dark × desktop/phone and checks each
// for horizontal overflow, console errors, and scroll-reveal content that is
// already visible before it animates (the "flash" bug).
//
//   node scripts/screenshot-pages.mjs <base-url> <out-dir>
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const [base, out = "screenshots"] = process.argv.slice(2);
if (!base) {
  console.error("usage: screenshot-pages.mjs <base-url> [out-dir]");
  process.exit(2);
}
const PAGES = [["landing", "/"], ["pricing", "/pricing"], ["employers", "/employers"], ["about", "/about"], ["contact", "/contact"]];
const VIEWPORTS = [["desktop", 1440, 900], ["phone", 400, 850]];
const THEMES = ["light", "dark"];
mkdirSync(out, { recursive: true });

// PW_CHANNEL=chrome uses an installed Chrome instead of the bundled browser.
const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
const results = [];
for (const theme of THEMES) {
  for (const [viewport, width, height] of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width, height }, colorScheme: theme });
    await context.addInitScript((t) => { try { localStorage.setItem("theme", t); } catch {} }, theme);
    const page = await context.newPage();
    let errors = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 200)));
    page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 200)));
    for (const [name, path] of PAGES) {
      errors = [];
      let status = 0;
      try {
        const res = await page.goto(new URL(path, base).toString(), { waitUntil: "networkidle", timeout: 45_000 });
        status = res?.status() ?? 0;
        await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
        await page.waitForTimeout(300);
      } catch (e) {
        errors.push(`navigation failed: ${e.message}`);
      }
      const probe = await page.evaluate(() => {
        const de = document.documentElement;
        let below = 0, visibleBelow = 0;
        for (const el of document.querySelectorAll(".m-reveal")) {
          if (el.getBoundingClientRect().top > innerHeight) {
            below++;
            if (getComputedStyle(el).opacity === "1") visibleBelow++;
          }
        }
        return { overflowPx: Math.max(0, de.scrollWidth - innerWidth), revealsBelowFold: below, revealsVisibleBeforeAnimating: visibleBelow };
      }).catch(() => ({ overflowPx: 0, revealsBelowFold: 0, revealsVisibleBeforeAnimating: 0 }));
      const file = `${name}-${viewport}-${theme}.png`;
      await page.screenshot({ path: `${out}/${file}` }).catch(() => {});
      results.push({ page: name, path, viewport, theme, status, file, errors: [...errors], ...probe });
    }
    await context.close();
  }
}
await browser.close();
writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));

const problems = results.filter(
  (r) => r.status >= 400 || r.overflowPx > 1 || r.errors.length || r.revealsVisibleBeforeAnimating > 0,
);
const lines = [
  "### Page review",
  "",
  "| Page | Overflow at 400px | Console errors | Reveal flash |",
  "|---|---|---|---|",
  ...PAGES.map(([name]) => {
    const rows = results.filter((r) => r.page === name);
    const overflow = Math.max(...rows.filter((r) => r.viewport === "phone").map((r) => r.overflowPx));
    const errs = rows.reduce((n, r) => n + r.errors.length, 0);
    const flash = rows.some((r) => r.revealsVisibleBeforeAnimating > 0);
    return `| ${name} | ${overflow > 1 ? `⚠️ ${overflow}px` : "✓ none"} | ${errs ? `⚠️ ${errs}` : "✓ 0"} | ${flash ? "⚠️ visible before animating" : "✓"} |`;
  }),
  "",
  problems.length ? `**${problems.length} problem(s)** found across ${results.length} renders.` : `All ${results.length} renders clean (5 pages × light/dark × desktop/phone).`,
];
writeFileSync(`${out}/summary.md`, lines.join("\n"));
console.log(lines.join("\n"));
