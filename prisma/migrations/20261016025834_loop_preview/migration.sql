-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "preview" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "previewRevision" INTEGER,
ADD COLUMN     "previewSnapshot" JSONB;

