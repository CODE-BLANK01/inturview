/**
 * One-off backfill for legacy users:
 *   - put everyone on the FREE tier
 *   - mark them as email-verified (they were using the app before verification existed)
 *   - mark them as already onboarded (skip the wizard)
 *
 *   npm run db:backfill-free
 *
 * Idempotent — safe to re-run.
 */
import { PlanTier, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 1. Plan: defensive — Prisma's @default(FREE) already filled this in on
  //    `db:push`, but we make it explicit so the row's value isn't "default,
  //    please coerce on read" — it's a real persisted FREE.
  const planResult = await prisma.user.updateMany({
    where: { plan: { not: PlanTier.FREE } },
    data: { plan: PlanTier.FREE },
  });

  // 2. Email verification: grandfather anyone who signed up before verification
  //    existed. They were actively using the app already — re-verifying would
  //    be punishing.
  const verifyResult = await prisma.user.updateMany({
    where: { emailVerifiedAt: null },
    data: { emailVerifiedAt: new Date() },
  });

  // 3. Onboarding: anyone who signed up before the wizard existed didn't get
  //    to pick a goal. Mark them as onboarded with no goal — they can edit
  //    their profile later if you build a settings page.
  const onboardingResult = await prisma.user.updateMany({
    where: { onboardingCompletedAt: null },
    data: { onboardingCompletedAt: new Date() },
  });

  console.log(`Plan column normalized:        ${planResult.count} row(s) touched`);
  console.log(`Email verified backfilled:     ${verifyResult.count} row(s) touched`);
  console.log(`Onboarding flag backfilled:    ${onboardingResult.count} row(s) touched`);
  console.log("Legacy users now: FREE plan, email-verified, onboarding skipped.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
