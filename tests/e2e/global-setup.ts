// Seeds two workspaces and their people for the journeys. Each run uses fresh
// slugs and emails, so runs never collide; data goes to TEST_DATABASE_URL only.
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import bcrypt from "bcryptjs";

export const FIXTURES = join(__dirname, ".fixtures.json");

export default async function globalSetup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("Set TEST_DATABASE_URL to a throwaway Postgres to run end-to-end tests.");
  if (!["localhost", "127.0.0.1", "postgres"].includes(new URL(url).hostname)) throw new Error("End-to-end tests only run against a local or CI database.");
  process.env.DATABASE_URL = url;

  const { prisma } = await import("../../lib/db");
  const { createQuestion, publishQuestion } = await import("../../lib/questionBank");
  const { publishLoop } = await import("../../lib/loopTemplates");

  const run = randomBytes(3).toString("hex");
  // A fresh password every run, kept only in the gitignored fixtures file.
  const password = randomBytes(12).toString("base64url");
  const hash = await bcrypt.hash(password, 10);
  const user = (who: string, practice = false) =>
    prisma.user.create({
      data: { email: `${who}-${run}@e2e.test`, name: who[0]!.toUpperCase() + who.slice(1), passwordHash: hash, emailVerifiedAt: new Date(), onboardingCompletedAt: practice ? new Date() : null },
    });
  const [owner, reviewer, outsider] = [await user("owner"), await user("reviewer", true), await user("outsider")];
  const orgA = await prisma.organization.create({ data: { name: `Acme ${run}`, slug: `e2e-a-${run}`, contactEmail: "talent@e2e.test", timezone: "America/New_York" } });
  const orgB = await prisma.organization.create({ data: { name: `Beta ${run}`, slug: `e2e-b-${run}` } });
  await prisma.organizationMember.createMany({
    data: [
      { organizationId: orgA.id, userId: owner.id, role: "OWNER" },
      { organizationId: orgA.id, userId: reviewer.id, role: "REVIEWER" },
      { organizationId: orgB.id, userId: outsider.id, role: "OWNER" },
    ],
  });

  const q = await createQuestion(
    { category: "BEHAVIORAL", title: "A project you're proud of", prompt: "Tell me about a project you're proud of and what you'd change.", followUps: [], signals: ["Specific", "Owns the outcome"], levels: [], roles: [], tags: [], difficulty: null, details: null },
    { organizationId: orgA.id },
  );
  await publishQuestion(q.id, null);
  const loop = await prisma.loopTemplate.create({
    data: {
      name: "Backend screen",
      organizationId: orgA.id,
      rounds: [{ id: "r1", category: "BEHAVIORAL", title: "How you work", durationMinutes: 20, candidateBrief: "", questions: { mode: "fixed", questionIds: [q.id] } }],
    },
  });
  await publishLoop(loop.id, null);
  const role = await prisma.hiringRole.create({ data: { organizationId: orgA.id, title: "Backend engineer", loopTemplateId: loop.id } });

  writeFileSync(
    FIXTURES,
    JSON.stringify({
      run,
      password,
      slugA: orgA.slug,
      slugB: orgB.slug,
      orgA: orgA.id,
      owner: owner.email,
      reviewer: reviewer.email,
      outsider: outsider.email,
      loopId: loop.id,
      roleId: role.id,
      questionId: q.id,
    }),
  );
  await prisma.$disconnect();

  // The dev server compiles routes (and the middleware) on first use; a first
  // sign-in can race that compile and look signed out. Warm them up once.
  const base = `http://localhost:${process.env.E2E_PORT ?? 3100}`;
  for (const path of ["/dashboard", "/hire", `/hire/${orgA.slug}`, "/signin", "/api/auth/session", "/i/warm-up-token-that-does-not-exist"]) {
    await fetch(base + path, { redirect: "manual" }).catch(() => undefined);
  }
}
