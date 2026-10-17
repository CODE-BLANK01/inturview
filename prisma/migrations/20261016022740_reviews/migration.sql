-- CreateEnum
CREATE TYPE "Decision" AS ENUM ('ADVANCE', 'DECLINE');

-- CreateEnum
CREATE TYPE "ReviewKind" AS ENUM ('NOTE', 'RATING', 'DECISION');

-- AlterTable
ALTER TABLE "Invite" ADD COLUMN     "decidedAt" TIMESTAMP(3),
ADD COLUMN     "decidedById" TEXT,
ADD COLUMN     "decision" "Decision";

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "inviteId" TEXT NOT NULL,
    "authorId" TEXT,
    "kind" "ReviewKind" NOT NULL,
    "body" TEXT,
    "rating" INTEGER,
    "decision" "Decision",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewerAssignment" (
    "id" TEXT NOT NULL,
    "inviteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewerAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Review_inviteId_createdAt_idx" ON "Review"("inviteId", "createdAt");

-- CreateIndex
CREATE INDEX "ReviewerAssignment_userId_idx" ON "ReviewerAssignment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewerAssignment_inviteId_userId_key" ON "ReviewerAssignment"("inviteId", "userId");

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "Invite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewerAssignment" ADD CONSTRAINT "ReviewerAssignment_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "Invite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewerAssignment" ADD CONSTRAINT "ReviewerAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

