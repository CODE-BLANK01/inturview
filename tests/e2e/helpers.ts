import { readFileSync } from "node:fs";
import type { Browser, Page } from "@playwright/test";
import { FIXTURES } from "./global-setup";

export interface Fixtures {
  run: string;
  password: string;
  slugA: string;
  slugB: string;
  orgA: string;
  owner: string;
  reviewer: string;
  outsider: string;
  both: string;
  loopId: string;
  roleId: string;
  questionId: string;
}

export const fixtures = (): Fixtures => JSON.parse(readFileSync(FIXTURES, "utf8"));

/** A fresh browser context signed in as `email`, through the real sign-in form. */
export async function signIn(browser: Browser, email: string, callbackUrl?: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto(`/signin${callbackUrl ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`);
  await page.fill('input[autocomplete="email"]', email);
  await page.fill('input[type="password"]', fixtures().password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/signin"));
  return page;
}

/** Database access for arranging state and reading what the app wrote. */
export async function db() {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  return (await import("../../lib/db")).prisma;
}
