import { expect, test } from "@playwright/test";
import { fixtures, signIn } from "./helpers";

test("publishing right after an edit doesn't raise a false conflict (R03)", async ({ browser }) => {
  const f = fixtures();
  const page = await signIn(browser, f.owner, `/hire/${f.slugA}/loops/${f.loopId}`);
  await page.goto(`/hire/${f.slugA}/loops/${f.loopId}`);
  await page.fill("#loop-role", `Backend R03 ${Date.now()}`);
  await expect(page.locator("aside ul li").first()).toContainText("Role changed");
  await page.getByRole("button", { name: "Publish changes" }).click();
  await expect(page.locator('aside [role="status"]')).toContainText("Published as version");
  await expect(page.getByRole("button", { name: /Reload the latest version/ })).toHaveCount(0);
});

test("edits made while a save is in flight stay unsaved (R08)", async ({ browser }) => {
  const f = fixtures();
  const page = await signIn(browser, f.owner, `/hire/${f.slugA}/loops/${f.loopId}`);
  await page.goto(`/hire/${f.slugA}/loops/${f.loopId}`);
  await page.route("**/api/hire/*/loops/*", async (route) => {
    if (route.request().method() === "PATCH") await new Promise((r) => setTimeout(r, 2000));
    await route.continue();
  });
  await page.fill("#loop-role", "Saved part");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.waitForTimeout(300);
  await page.fill("#loop-role", "Saved part, and an edit made during the save");
  await expect(page.locator('aside [role="status"]')).toContainText("You've made more changes since");
  await expect(page.getByText("Unsaved changes.")).toBeVisible();
});
