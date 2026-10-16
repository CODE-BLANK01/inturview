-- AlterTable
ALTER TABLE "LoopRoundRun" ADD COLUMN     "draftSeq" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "LoopMessage" ADD COLUMN     "replyClaimedAt" TIMESTAMP(3);

