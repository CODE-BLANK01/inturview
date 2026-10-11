-- CreateEnum
CREATE TYPE "QuestionCategory" AS ENUM ('RECRUITER_SCREEN', 'BEHAVIORAL', 'TECHNICAL', 'CODING', 'SYSTEM_DESIGN');

-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'RETIRED');

-- CreateEnum
CREATE TYPE "QuestionSource" AS ENUM ('SEED', 'ADMIN', 'AI_DRAFT', 'IMPORT');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "category" "QuestionCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "followUps" TEXT[],
    "signals" TEXT[],
    "details" JSONB,
    "levels" TEXT[],
    "roles" TEXT[],
    "tags" TEXT[],
    "difficulty" TEXT,
    "status" "QuestionStatus" NOT NULL DEFAULT 'DRAFT',
    "source" "QuestionSource" NOT NULL DEFAULT 'ADMIN',
    "sourceKey" TEXT,
    "currentVersion" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionVersion" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "publishedById" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Question_sourceKey_key" ON "Question"("sourceKey");

-- CreateIndex
CREATE INDEX "Question_category_status_idx" ON "Question"("category", "status");

-- CreateIndex
CREATE INDEX "Question_organizationId_idx" ON "Question"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionVersion_questionId_version_key" ON "QuestionVersion"("questionId", "version");

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionVersion" ADD CONSTRAINT "QuestionVersion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

