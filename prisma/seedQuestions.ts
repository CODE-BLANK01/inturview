/**
 * Imports the questions hardcoded in lib/*.ts into the question bank, published
 * as version 1. Safe to re-run: questions already imported are left alone, so
 * edits made in the admin dashboard are never overwritten.
 *
 *   npm run db:seed-questions
 */
import { PrismaClient, QuestionSource } from "@prisma/client";
import { seedQuestions } from "../lib/questionSeed";
import { QuestionInputSchema, snapshotOf } from "../lib/questionBank";

const prisma = new PrismaClient();

async function main() {
  const rows = seedQuestions();
  let created = 0;
  let skipped = 0;
  for (const { sourceKey, input } of rows) {
    const data = QuestionInputSchema.parse(input);
    const existing = await prisma.question.findUnique({ where: { sourceKey }, select: { id: true } });
    if (existing) {
      skipped++;
      continue;
    }
    const details = data.details === null ? undefined : (data.details as object);
    await prisma.$transaction(async (tx) => {
      const q = await tx.question.create({
        data: { ...data, details, source: QuestionSource.SEED, sourceKey, status: "PUBLISHED", currentVersion: 1 },
      });
      await tx.questionVersion.create({ data: { questionId: q.id, version: 1, snapshot: snapshotOf(q) as object } });
    });
    created++;
  }
  console.log(`Question bank: ${created} imported, ${skipped} already present (${rows.length} total).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
