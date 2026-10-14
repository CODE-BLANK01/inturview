-- CreateEnum
CREATE TYPE "LoopStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "LoopTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "roleTarget" TEXT,
    "level" TEXT,
    "rounds" JSONB NOT NULL DEFAULT '[]',
    "status" "LoopStatus" NOT NULL DEFAULT 'DRAFT',
    "currentVersion" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoopTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoopTemplateVersion" (
    "id" TEXT NOT NULL,
    "loopTemplateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "publishedById" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoopTemplateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoopTemplate_organizationId_status_idx" ON "LoopTemplate"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LoopTemplateVersion_loopTemplateId_version_key" ON "LoopTemplateVersion"("loopTemplateId", "version");

-- AddForeignKey
ALTER TABLE "LoopTemplate" ADD CONSTRAINT "LoopTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoopTemplateVersion" ADD CONSTRAINT "LoopTemplateVersion_loopTemplateId_fkey" FOREIGN KEY ("loopTemplateId") REFERENCES "LoopTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

