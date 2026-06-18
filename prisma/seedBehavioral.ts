/**
 * Seeds the BehavioralScenario table from lib/behavioralScenarios.ts.
 * Idempotent — re-runnable, updates rows by id.
 *   npm run db:seed-behavioral
 */
import { PrismaClient } from "@prisma/client";
import { BEHAVIORAL_SCENARIOS } from "../lib/behavioralScenarios";

const prisma = new PrismaClient();

async function main() {
  console.log(`Seeding ${BEHAVIORAL_SCENARIOS.length} behavioral scenarios…`);
  for (const s of BEHAVIORAL_SCENARIOS) {
    const data = {
      title: s.title,
      category: s.category,
      prompt: s.prompt,
      expectedSignals: s.expectedSignals,
    };
    await prisma.behavioralScenario.upsert({
      where: { id: s.id },
      create: { id: s.id, ...data },
      update: data,
    });
  }
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
