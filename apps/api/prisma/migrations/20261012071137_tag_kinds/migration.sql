-- CreateEnum
CREATE TYPE "TagKind" AS ENUM ('THEME', 'MOOD', 'AUDIENCE', 'ERA');

-- CreateEnum
CREATE TYPE "TagSource" AS ENUM ('RULE', 'EDITOR');

-- DropForeignKey
ALTER TABLE "AuthorTag" DROP CONSTRAINT "AuthorTag_authorId_fkey";

-- DropForeignKey
ALTER TABLE "AuthorTag" DROP CONSTRAINT "AuthorTag_tagId_fkey";

-- DropForeignKey
ALTER TABLE "WorkTag" DROP CONSTRAINT "WorkTag_tagId_fkey";

-- DropForeignKey
ALTER TABLE "WorkTag" DROP CONSTRAINT "WorkTag_workId_fkey";

-- AlterTable
ALTER TABLE "Tag" ADD COLUMN     "kind" "TagKind" NOT NULL DEFAULT 'THEME',
ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "WorkTag" ADD COLUMN     "source" "TagSource" NOT NULL DEFAULT 'EDITOR';

-- CreateIndex
CREATE INDEX "WorkTag_tagId_idx" ON "WorkTag"("tagId");

-- AddForeignKey
ALTER TABLE "AuthorTag" ADD CONSTRAINT "AuthorTag_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Author"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthorTag" ADD CONSTRAINT "AuthorTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkTag" ADD CONSTRAINT "WorkTag_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkTag" ADD CONSTRAINT "WorkTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
