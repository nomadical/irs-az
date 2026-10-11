-- CreateEnum
CREATE TYPE "Language" AS ENUM ('AZ_LATIN', 'AZ_ARABIC', 'AZ_CYRILLIC', 'FA', 'AR', 'RU', 'EN', 'TR');

-- CreateEnum
CREATE TYPE "ScriptDirection" AS ENUM ('LTR', 'RTL');

-- CreateEnum
CREATE TYPE "Genre" AS ENUM ('POEM', 'PROSE', 'PLAY', 'ESSAY', 'PHILOSOPHY', 'LETTER', 'MEMOIR');

-- CreateEnum
CREATE TYPE "PoemForm" AS ENUM ('GHAZAL', 'MASNAVI', 'RUBAI', 'QASIDA', 'MURABBA', 'FREE_VERSE', 'OTHER');

-- CreateEnum
CREATE TYPE "AuthorType" AS ENUM ('POET', 'WRITER', 'PHILOSOPHER', 'PLAYWRIGHT', 'CRITIC');

-- CreateEnum
CREATE TYPE "TranslationType" AS ENUM ('TRANSLATION', 'TRANSLITERATION', 'MODERNIZATION');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPERADMIN', 'EDITOR', 'CONTRIBUTOR', 'READER');

-- CreateEnum
CREATE TYPE "SubmissionType" AS ENUM ('AUTHOR', 'WORK', 'TRANSLATION');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED');

-- CreateEnum
CREATE TYPE "PublishStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'READER',
    "avatarUrl" TEXT,
    "bio" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Author" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nameAz" TEXT NOT NULL,
    "nameRu" TEXT,
    "nameFa" TEXT,
    "nameEn" TEXT,
    "bornYear" INTEGER,
    "bornYearApprox" BOOLEAN NOT NULL DEFAULT false,
    "diedYear" INTEGER,
    "diedYearApprox" BOOLEAN NOT NULL DEFAULT false,
    "bornPlace" TEXT,
    "diedPlace" TEXT,
    "type" "AuthorType" NOT NULL DEFAULT 'POET',
    "period" TEXT,
    "writingLangs" "Language"[],
    "bioAz" TEXT,
    "bioRu" TEXT,
    "bioEn" TEXT,
    "portraitUrl" TEXT,
    "portraitSource" TEXT,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "featuredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Author_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "titleAz" TEXT NOT NULL,
    "titleRu" TEXT,
    "titleFa" TEXT,
    "titleEn" TEXT,
    "authorId" TEXT NOT NULL,
    "year" INTEGER,
    "yearApprox" BOOLEAN NOT NULL DEFAULT false,
    "originalLang" "Language" NOT NULL DEFAULT 'AZ_LATIN',
    "genre" "Genre" NOT NULL DEFAULT 'POEM',
    "descriptionAz" TEXT,
    "descriptionRu" TEXT,
    "order" INTEGER,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Work" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "titleAz" TEXT NOT NULL,
    "titleRu" TEXT,
    "titleFa" TEXT,
    "titleEn" TEXT,
    "body" TEXT NOT NULL,
    "bodyHtml" TEXT,
    "originalLang" "Language" NOT NULL,
    "scriptDirection" "ScriptDirection" NOT NULL DEFAULT 'LTR',
    "genre" "Genre" NOT NULL DEFAULT 'POEM',
    "form" "PoemForm",
    "year" INTEGER,
    "yearApprox" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER,
    "authorId" TEXT NOT NULL,
    "collectionId" TEXT,
    "sourceNote" TEXT,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Work_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Translation" (
    "id" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "language" "Language" NOT NULL,
    "type" "TranslationType" NOT NULL DEFAULT 'TRANSLATION',
    "scriptDirection" "ScriptDirection" NOT NULL DEFAULT 'LTR',
    "body" TEXT NOT NULL,
    "bodyHtml" TEXT,
    "translator" TEXT,
    "translatorNote" TEXT,
    "year" INTEGER,
    "sourceNote" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "submissionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Translation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nameAz" TEXT NOT NULL,
    "nameRu" TEXT,
    "nameEn" TEXT,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthorTag" (
    "authorId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "AuthorTag_pkey" PRIMARY KEY ("authorId","tagId")
);

-- CreateTable
CREATE TABLE "WorkTag" (
    "workId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "WorkTag_pkey" PRIMARY KEY ("workId","tagId")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "type" "SubmissionType" NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "userId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "sourceNote" TEXT,
    "authorId" TEXT,
    "workId" TEXT,
    "reviewNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlogPost" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "titleAz" TEXT NOT NULL,
    "titleRu" TEXT,
    "titleEn" TEXT,
    "bodyAz" TEXT NOT NULL,
    "bodyRu" TEXT,
    "bodyEn" TEXT,
    "excerpt" TEXT,
    "coverUrl" TEXT,
    "authorId" TEXT NOT NULL,
    "relatedAuthorId" TEXT,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlogPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Author_slug_key" ON "Author"("slug");

-- CreateIndex
CREATE INDEX "Author_slug_idx" ON "Author"("slug");

-- CreateIndex
CREATE INDEX "Author_nameAz_idx" ON "Author"("nameAz");

-- CreateIndex
CREATE INDEX "Author_period_idx" ON "Author"("period");

-- CreateIndex
CREATE INDEX "Author_type_idx" ON "Author"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Collection_slug_key" ON "Collection"("slug");

-- CreateIndex
CREATE INDEX "Collection_authorId_idx" ON "Collection"("authorId");

-- CreateIndex
CREATE INDEX "Collection_slug_idx" ON "Collection"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Work_slug_key" ON "Work"("slug");

-- CreateIndex
CREATE INDEX "Work_authorId_idx" ON "Work"("authorId");

-- CreateIndex
CREATE INDEX "Work_collectionId_order_idx" ON "Work"("collectionId", "order");

-- CreateIndex
CREATE INDEX "Work_slug_idx" ON "Work"("slug");

-- CreateIndex
CREATE INDEX "Work_originalLang_idx" ON "Work"("originalLang");

-- CreateIndex
CREATE INDEX "Work_year_idx" ON "Work"("year");

-- CreateIndex
CREATE UNIQUE INDEX "Translation_submissionId_key" ON "Translation"("submissionId");

-- CreateIndex
CREATE INDEX "Translation_workId_idx" ON "Translation"("workId");

-- CreateIndex
CREATE INDEX "Translation_language_idx" ON "Translation"("language");

-- CreateIndex
CREATE UNIQUE INDEX "Translation_workId_language_type_key" ON "Translation"("workId", "language", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

-- CreateIndex
CREATE INDEX "Submission_status_idx" ON "Submission"("status");

-- CreateIndex
CREATE INDEX "Submission_userId_idx" ON "Submission"("userId");

-- CreateIndex
CREATE INDEX "Submission_type_idx" ON "Submission"("type");

-- CreateIndex
CREATE UNIQUE INDEX "BlogPost_slug_key" ON "BlogPost"("slug");

-- CreateIndex
CREATE INDEX "BlogPost_slug_idx" ON "BlogPost"("slug");

-- CreateIndex
CREATE INDEX "BlogPost_publishedAt_idx" ON "BlogPost"("publishedAt");

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Author"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Work" ADD CONSTRAINT "Work_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Author"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Work" ADD CONSTRAINT "Work_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Translation" ADD CONSTRAINT "Translation_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Translation" ADD CONSTRAINT "Translation_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthorTag" ADD CONSTRAINT "AuthorTag_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Author"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthorTag" ADD CONSTRAINT "AuthorTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkTag" ADD CONSTRAINT "WorkTag_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkTag" ADD CONSTRAINT "WorkTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Author"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogPost" ADD CONSTRAINT "BlogPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
