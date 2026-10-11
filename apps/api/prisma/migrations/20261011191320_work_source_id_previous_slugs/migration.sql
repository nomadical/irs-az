-- AlterTable
ALTER TABLE "Work" ADD COLUMN     "previousSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "sourceId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Work_sourceId_key" ON "Work"("sourceId");

-- CreateIndex
CREATE INDEX "Work_previousSlugs_idx" ON "Work" USING GIN ("previousSlugs");

