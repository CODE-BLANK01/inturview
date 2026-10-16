import { expect, test } from "@playwright/test";
import { db, fixtures, signIn } from "./helpers";

/** A candidate who has finished and been scored, without going through the interview. */
async function finishedCandidate(name: string) {
  const f = fixtures();
  const prisma = await db();
  const campaign = await prisma.campaign.create({ data: { organizationId: f.orgA, hiringRoleId: f.roleId, loopTemplateId: f.loopId, loopVersion: 1, name: `Seeded ${name}` } });
  const invite = await prisma.invite.create({ data: { campaignId: campaign.id, email: `${name.toLowerCase()}-${f.run}@e2e.test`, name, status: "COMPLETED", completedAt: new Date() } });
  const run = await prisma.loopRun.create({ data: { inviteId: invite.id, loopTemplateId: f.loopId, loopVersion: 1, status: "COMPLETED", overallScore: 50 } });
  await prisma.loopRoundRun.create({
    data: {
      runId: run.id, roundIndex: 0, roundId: "r1", category: "BEHAVIORAL", status: "COMPLETED", score: 50,
      questions: [{ questionId: f.questionId, version: 1, title: "A project you're proud of", prompt: "Tell me about it.", followUps: [], signals: [] }],
      scorecard: { version: 2, questions: [{ questionId: f.questionId, score: 3, evidence: "Concrete example.", missing: "" }], strengths: [], improvements: [], summary: "Solid example.", score: 50, assessed: 1, total: 1 },
    },
  });
  return invite.id;
}

test("reviewers see only their assignments, rate blind, and the owner decides", async ({ browser }) => {
  const f = fixtures();
  const assigned = await finishedCandidate("Cara");
  const other = await finishedCandidate("Dev");

  const owner = await signIn(browser, f.owner, `/hire/${f.slugA}/candidates/${assigned}`);
  await owner.goto(`/hire/${f.slugA}/candidates/${assigned}`);
  await owner.selectOption('select[aria-label="Teammate to assign"]', { label: "Reviewer" });
  await owner.getByRole("button", { name: "Assign" }).click();
  await expect(owner.locator("li").filter({ hasText: /^Reviewer$/ })).toBeVisible();
  await owner.getByRole("button", { name: "4 of 5" }).click();
  await expect(owner.getByRole("button", { name: "4 of 5" })).toHaveAttribute("aria-pressed", "true");

  const reviewer = await signIn(browser, f.reviewer, `/hire/${f.slugA}/reviews`);
  await reviewer.goto(`/hire/${f.slugA}/reviews`);
  await expect(reviewer.locator("aside nav")).toContainText("My reviews");
  await expect(reviewer.locator("aside nav")).not.toContainText("Candidates");
  await reviewer.getByRole("link", { name: "Cara" }).click();
  await expect(reviewer.getByText(/Rate first to see your teammates/)).toBeVisible();
  await expect(reviewer.getByRole("button", { name: "Advance" })).toHaveCount(0);
  await reviewer.getByRole("button", { name: "3 of 5" }).click();
  await expect(reviewer.getByText("Owner: 4/5")).toBeVisible();
  await reviewer.goto(`/hire/${f.slugA}/candidates/${other}`);
  await expect(reviewer.getByText("This page could not be found")).toBeVisible();

  await owner.reload();
  await owner.getByRole("button", { name: "Advance" }).click();
  await owner.getByRole("button", { name: "Confirm advance" }).click();
  await expect(owner.getByText(/^Advanced/)).toBeVisible();
  await owner.goto(`/hire/${f.slugA}/candidates?stage=advanced`);
  await expect(owner.getByRole("link", { name: "Cara" }).first()).toBeVisible();
});
