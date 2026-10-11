-- DropIndex
DROP INDEX "Translation_workId_language_type_key";

-- CreateIndex
CREATE INDEX "Translation_workId_language_idx" ON "Translation"("workId", "language");

