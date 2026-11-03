import { expect, test, type Browser, type Page } from "@playwright/test";
import { db, fixtures, signIn } from "./helpers";

/** Invites `email` from the role page, like a recruiter would, and returns the emailed link. */
async function inviteFromRole(browser: Browser, name: string, email: string): Promise<string> {
  const f = fixtures();
  const owner = await signIn(browser, f.owner, `/hire/${f.slugA}/roles/${f.roleId}`);
  await owner.goto(`/hire/${f.slugA}/roles/${f.roleId}`);
  if (!(await owner.locator("#recipients").isVisible())) await owner.getByText("Invite candidates", { exact: true }).click();
  await owner.fill("#recipients", `${name}\t${email}`);
  await owner.getByRole("button", { name: "Send 1 invite" }).click();
  await expect(owner.locator('p[role="status"]').filter({ hasText: "added" })).toContainText("1 added · 1 email sent");
  // The link in the email is derived from the delivery; read it the way the email was built.
  const prisma = await db();
  const { deliveryToken } = await import("../../lib/delivery");
  const delivery = await prisma.delivery.findFirstOrThrow({ where: { invite: { email }, state: "SENT" } });
  return `/i/${deliveryToken(delivery.id)}`;
}

async function startRound(page: Page, link: string) {
  await page.goto(link);
  await expect(page.getByText(/Interview with Acme/)).toBeVisible();
  await page.check("#invite-consent");
  await page.getByRole("button", { name: "Agree and continue" }).click();
  await page.getByRole("link", { name: "Start round 1" }).click();
  await expect(page.locator("textarea")).toBeEnabled();
}

async function answer(page: Page, text: string) {
  await page.fill("textarea", text);
  await page.getByRole("button", { name: "Send" }).click();
}

test("an applicant takes the interview from their email link, through a cut-off reply, to submission", async ({ browser }) => {
  const f = fixtures();
  const email = `ada-${f.run}@e2e.test`;
  const link = await inviteFromRole(browser, "Ada Applicant", email);
  const page = await (await browser.newContext()).newPage();
  await startRound(page, link);

  await answer(page, "I led a migration to a queue and cut payment timeouts from 4% to 0.1%.");
  await expect(page.locator(".self-start").last()).toContainText("hardest trade-off");

  // C09: the connection drops after the first chunk, before "done".
  await page.route("**/api/i/message", async (route) => {
    const res = await route.fetch();
    await route.fulfill({ status: 200, headers: { "content-type": "application/x-ndjson" }, body: (await res.text()).split("\n")[0] + "\n" });
  }, { times: 1 });
  await answer(page, "Speed versus safety: we shipped behind a flag and rolled out over a week.");
  await expect(page.getByRole("alert").filter({ hasText: "The reply was cut off." })).toBeVisible();
  await page.getByRole("button", { name: "Get the reply" }).click();

  // The saved reply closes the round.
  await expect(page.getByText("Round 1 complete.")).toBeVisible();
  await page.getByRole("link", { name: "Finish" }).click();
  await expect(page.getByRole("heading", { name: "Your interview is submitted" })).toBeVisible();

  const prisma = await db();
  const run = await prisma.loopRun.findFirstOrThrow({ where: { invite: { email } }, include: { rounds: { include: { messages: true } } } });
  expect(run.rounds[0]!.messages.filter((m) => m.role === "candidate")).toHaveLength(2);
  await expect.poll(async () => (await prisma.loopRoundRun.findUniqueOrThrow({ where: { id: run.rounds[0]!.id } })).status).toBe("COMPLETED");
});

test("a round the interviewer closed stays closed when the page is refreshed before Finish (R06)", async ({ browser }) => {
  const f = fixtures();
  const email = `ben-${f.run}@e2e.test`;
  const link = await inviteFromRole(browser, "Ben Applicant", email);
  const page = await (await browser.newContext()).newPage();
  await startRound(page, link);
  // The browser never gets to say Finish.
  await page.route("**/api/i/finish", (route) => route.abort());
  await answer(page, "First answer with a concrete example.");
  await expect(page.locator(".self-start").last()).toContainText("hardest trade-off");
  await answer(page, "Second answer about the trade-off.");
  await expect(page.locator(".self-start").last()).toContainText("that's everything");
  await page.reload();
  await expect(page.getByText("Round 1 complete.")).toBeVisible();
  await expect(page.locator("textarea")).toHaveCount(0);
});
