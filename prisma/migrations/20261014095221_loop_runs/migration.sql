-- CreateEnum
CREATE TYPE "LoopRunStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "RoundRunStatus" AS ENUM ('IN_PROGRESS', 'SCORING', 'COMPLETED');

-- CreateTable
CREATE TABLE "LoopRun" (
    "id" TEXT NOT NULL,
    "inviteId" TEXT NOT NULL,
    "userId" TEXT,
    "loopTemplateId" TEXT NOT NULL,
    "loopVersion" INTEGER NOT NULL,
    "status" "LoopRunStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "overallScore" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "LoopRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoopRoundRun" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "roundIndex" INTEGER NOT NULL,
    "roundId" TEXT NOT NULL,
    "category" "QuestionCategory" NOT NULL,
    "questions" JSONB NOT NULL,
    "status" "RoundRunStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "scorecard" JSONB,
    "score" INTEGER,

    CONSTRAINT "LoopRoundRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoopMessage" (
    "id" TEXT NOT NULL,
    "roundRunId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoopMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LoopRun_inviteId_key" ON "LoopRun"("inviteId");

-- CreateIndex
CREATE UNIQUE INDEX "LoopRoundRun_runId_roundIndex_key" ON "LoopRoundRun"("runId", "roundIndex");

-- CreateIndex
CREATE INDEX "LoopMessage_roundRunId_createdAt_idx" ON "LoopMessage"("roundRunId", "createdAt");

-- AddForeignKey
ALTER TABLE "LoopRun" ADD CONSTRAINT "LoopRun_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "Invite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoopRoundRun" ADD CONSTRAINT "LoopRoundRun_runId_fkey" FOREIGN KEY ("runId") REFERENCES "LoopRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoopMessage" ADD CONSTRAINT "LoopMessage_roundRunId_fkey" FOREIGN KEY ("roundRunId") REFERENCES "LoopRoundRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

