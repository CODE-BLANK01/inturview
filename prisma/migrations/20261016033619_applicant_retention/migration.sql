-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "retentionMonths" INTEGER NOT NULL DEFAULT 12;

-- AlterTable
ALTER TABLE "Invite" ADD COLUMN     "lastActivityAt" TIMESTAMP(3),
ADD COLUMN     "redactedAt" TIMESTAMP(3);

