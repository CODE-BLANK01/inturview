import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { fixtures, signIn } from "./helpers";

test("a hiring teammate signing in from the plain sign-in page lands in their workspace (R10)", async ({ browser }) => {
  const f = fixtures();
  const page = await signIn(browser, f.owner);
  await expect(page).toHaveURL(new RegExp(`/hire/${f.slugA}$`));
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Acme");
});

test("another company's workspace is a 404, pages and API alike", async ({ browser }) => {
  const f = fixtures();
  const page = await signIn(browser, f.outsider, `/hire/${f.slugB}`);
  const res = await page.goto(`/hire/${f.slugA}/candidates`);
  await expect(page.getByText("This page could not be found")).toBeVisible();
  expect(res?.ok() === false || (await page.content()).includes("could not be found")).toBeTruthy();
  const api = await page.request.patch(`/api/hire/${f.slugA}/settings`, { data: { name: "Hijacked", timezone: "UTC", website: null, logoUrl: null, contactEmail: null } });
  expect(api.status()).toBe(404);
});

const lastProduct = async (page: Page) => (await page.context().cookies()).find((c) => c.name === "iv_product")?.value;

/** Signs out (the session only; the browser keeps its other cookies) and back in with no destination. */
async function signInAgain(page: Page, email: string) {
  await page.context().clearCookies({ name: /next-auth/ });
  await page.goto("/signin");
  await page.fill('input[autocomplete="email"]', email);
  await page.fill('input[type="password"]', fixtures().password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/signin") && u.pathname !== "/start");
}

test("someone using both products goes back to the one they used last", async ({ browser }) => {
  const f = fixtures();
  const page = await signIn(browser, f.both);
  await expect(page).toHaveURL(/\/dashboard$/); // nothing remembered yet, and Practice is set up

  await page.goto(`/hire/${f.slugA}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Acme");
  await expect.poll(() => lastProduct(page)).toBe("hire");
  await signInAgain(page, f.both);
  await expect(page).toHaveURL(new RegExp(`/hire/${f.slugA}$`));

  // The Practice link from Hire still reaches Practice, and becomes the place to return to.
  await page.getByRole("link", { name: "Practice" }).first().click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect.poll(() => lastProduct(page)).toBe("practice");
  await signInAgain(page, f.both);
  await expect(page).toHaveURL(/\/dashboard$/);
});
