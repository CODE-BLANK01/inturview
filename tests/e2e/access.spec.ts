import { expect, test } from "@playwright/test";
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
