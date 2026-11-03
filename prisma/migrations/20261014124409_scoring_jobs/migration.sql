-- CreateEnum
CREATE TYPE "ScoringStatus" AS ENUM ('SUCCEEDED', 'INVALID', 'ERROR');

-- CreateEnum
CREATE TYPE "JobState" AS ENUM ('QUEUED', 'RUNNING', 'DONE', 'FAILED');

-- AlterEnum
ALTER TYPE "RoundRunStatus" ADD VALUE 'SCORING_FAILED';

-- AlterTable
ALTER TABLE "LoopRun" ADD COLUMN     "assessedQuestions" INTEGER,
ADD COLUMN     "totalQuestions" INTEGER;

-- CreateTable
CREATE TABLE "ScoringAttempt" (
    "id" TEXT NOT NULL,
    "roundRunId" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "status" "ScoringStatus" NOT NULL,
    "scorecard" JSONB,
    "score" INTEGER,
    "assessed" INTEGER,
    "total" INTEGER,
    "model" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoringAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "state" "JobState" NOT NULL DEFAULT 'QUEUED',
    "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "claimId" TEXT,
    "claimedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScoringAttempt_roundRunId_attempt_key" ON "ScoringAttempt"("roundRunId", "attempt");

-- CreateIndex
CREATE INDEX "Job_state_runAfter_idx" ON "Job"("state", "runAfter");

-- CreateIndex
CREATE INDEX "Job_key_idx" ON "Job"("key");

-- AddForeignKey
ALTER TABLE "ScoringAttempt" ADD CONSTRAINT "ScoringAttempt_roundRunId_fkey" FOREIGN KEY ("roundRunId") REFERENCES "LoopRoundRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- One queued or running job per key: re-score clicks and retries can't pile up.
CREATE UNIQUE INDEX "Job_one_active_per_key" ON "Job"("key") WHERE "state" IN ('QUEUED', 'RUNNING');
