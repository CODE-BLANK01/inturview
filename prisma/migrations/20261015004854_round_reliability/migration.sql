-- AlterTable
ALTER TABLE "LoopRoundRun" ADD COLUMN     "deadlineAt" TIMESTAMP(3),
ADD COLUMN     "draft" TEXT,
ADD COLUMN     "draftSavedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "LoopMessage" ADD COLUMN     "clientTurnId" TEXT,
ADD COLUMN     "endsRound" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "replyToId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "LoopMessage_replyToId_key" ON "LoopMessage"("replyToId");

-- CreateIndex
CREATE UNIQUE INDEX "LoopMessage_roundRunId_clientTurnId_key" ON "LoopMessage"("roundRunId", "clientTurnId");

