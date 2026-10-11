-- CreateTable
CREATE TABLE "Artwork" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "objectDate" TEXT,
    "yearStart" INTEGER,
    "yearEnd" INTEGER,
    "medium" TEXT,
    "artists" TEXT,
    "imageUrl" TEXT NOT NULL,
    "imageSmallUrl" TEXT,
    "additionalImages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "museum" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "creditLine" TEXT,
    "license" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "collectionId" TEXT,
    "workId" TEXT,
    "order" INTEGER,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Artwork_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Artwork_sourceId_key" ON "Artwork"("sourceId");

-- CreateIndex
CREATE INDEX "Artwork_authorId_idx" ON "Artwork"("authorId");

-- CreateIndex
CREATE INDEX "Artwork_collectionId_idx" ON "Artwork"("collectionId");

-- CreateIndex
CREATE INDEX "Artwork_workId_idx" ON "Artwork"("workId");

-- AddForeignKey
ALTER TABLE "Artwork" ADD CONSTRAINT "Artwork_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Author"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artwork" ADD CONSTRAINT "Artwork_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artwork" ADD CONSTRAINT "Artwork_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE SET NULL ON UPDATE CASCADE;
