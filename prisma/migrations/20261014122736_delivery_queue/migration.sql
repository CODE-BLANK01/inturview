-- CreateEnum
CREATE TYPE "DeliveryState" AS ENUM ('QUEUED', 'SENDING', 'SENT', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Delivery" (
    "id" TEXT NOT NULL,
    "inviteId" TEXT NOT NULL,
    "state" "DeliveryState" NOT NULL DEFAULT 'QUEUED',
    "tokenHash" TEXT NOT NULL,
    "claimId" TEXT,
    "claimedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "providerMessageId" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Delivery_tokenHash_key" ON "Delivery"("tokenHash");

-- CreateIndex
CREATE INDEX "Delivery_state_runAfter_idx" ON "Delivery"("state", "runAfter");

-- CreateIndex
CREATE INDEX "Delivery_inviteId_idx" ON "Delivery"("inviteId");

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "Invite"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- One in-flight send per invite: two "Send" clicks can't queue competing links.
CREATE UNIQUE INDEX "Delivery_one_active_per_invite" ON "Delivery"("inviteId") WHERE "state" IN ('QUEUED', 'SENDING');
