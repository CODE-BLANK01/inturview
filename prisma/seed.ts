/**
 * Seeds the Problem table from lib/problems.ts.
 * Idempotent — re-running updates existing rows by id.
 *   pnpm/npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import { PROBLEMS } from "../lib/problems";

const prisma = new PrismaClient();

async function main() {
  console.log(`Seeding ${PROBLEMS.length} problems…`);
  for (const p of PROBLEMS) {
    await prisma.problem.upsert({
      where: { id: p.id },
      create: {
        id: p.id,
        title: p.title,
        difficulty: p.difficulty,
        topic: p.topic,
        leetcodeUrl: p.leetcode_url,
        description: p.description,
        examples: p.examples,
        constraints: p.constraints,
        optimalTime: p.optimal_time,
        optimalSpace: p.optimal_space,
        tags: p.tags,
      },
      update: {
        title: p.title,
        difficulty: p.difficulty,
        topic: p.topic,
        leetcodeUrl: p.leetcode_url,
        description: p.description,
        examples: p.examples,
        constraints: p.constraints,
        optimalTime: p.optimal_time,
        optimalSpace: p.optimal_space,
        tags: p.tags,
      },
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
