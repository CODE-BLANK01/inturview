-- CreateEnum
CREATE TYPE "HiringRoleStatus" AS ENUM ('OPEN', 'PAUSED', 'CLOSED');

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "hiringRoleId" TEXT;

-- CreateTable
CREATE TABLE "HiringRole" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "seniority" TEXT,
    "location" TEXT,
    "context" TEXT,
    "status" "HiringRoleStatus" NOT NULL DEFAULT 'OPEN',
    "loopTemplateId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HiringRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HiringRole_organizationId_status_idx" ON "HiringRole"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Campaign_hiringRoleId_idx" ON "Campaign"("hiringRoleId");

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_hiringRoleId_fkey" FOREIGN KEY ("hiringRoleId") REFERENCES "HiringRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiringRole" ADD CONSTRAINT "HiringRole_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiringRole" ADD CONSTRAINT "HiringRole_loopTemplateId_fkey" FOREIGN KEY ("loopTemplateId") REFERENCES "LoopTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

