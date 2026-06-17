/**
 * Seeds the SystemDesignProblem table from lib/designProblems.ts.
 * Idempotent — re-runnable, updates rows by id.
 *   npm run db:seed-design
 */
import { PrismaClient } from "@prisma/client";
import { DESIGN_PROBLEMS } from "../lib/designProblems";

const prisma = new PrismaClient();

async function main() {
  console.log(`Seeding ${DESIGN_PROBLEMS.length} system-design problems…`);
  for (const p of DESIGN_PROBLEMS) {
    const data = {
      title: p.title,
      difficulty: p.difficulty,
      topic: p.topic,
      prompt: p.prompt,
      expectedRequirements: p.expectedRequirements,
      referenceArchitecture: p.referenceArchitecture,
      deepDiveTopics: p.deepDiveTopics,
      estimatedDurationMinutes: p.estimatedDurationMinutes,
    };
    await prisma.systemDesignProblem.upsert({
      where: { id: p.id },
      create: { id: p.id, ...data },
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
