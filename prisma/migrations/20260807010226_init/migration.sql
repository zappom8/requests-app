-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('QUEUED', 'PLAYED', 'DELETED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('NONE', 'PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateTable
CREATE TABLE "SongDatabase" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SongDatabase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Song" (
    "id" TEXT NOT NULL,
    "songDatabaseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "artist" TEXT NOT NULL,
    "decade" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Song_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Request" (
    "id" TEXT NOT NULL,
    "songDatabaseId" TEXT NOT NULL,
    "songId" TEXT,
    "songName" TEXT NOT NULL,
    "artistName" TEXT NOT NULL,
    "decade" TEXT,
    "requesterName" TEXT NOT NULL,
    "shoutOut" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'QUEUED',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "playedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "tipAmountCents" INTEGER NOT NULL DEFAULT 0,
    "stripePaymentIntentId" TEXT,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'NONE',
    "stripeFeeCents" INTEGER,
    "refundedAmountCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchLog" (
    "id" TEXT NOT NULL,
    "songDatabaseId" TEXT NOT NULL,
    "searchTerm" TEXT NOT NULL,
    "resultsFound" BOOLEAN NOT NULL,
    "eventType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "activeSongDatabaseId" TEXT,
    "bio" TEXT,
    "photoUrl" TEXT,
    "logoUrl" TEXT,
    "instagramUrl" TEXT,
    "facebookUrl" TEXT,
    "tiktokUrl" TEXT,
    "youtubeUrl" TEXT,
    "spotifyUrl" TEXT,
    "websiteUrl" TEXT,
    "contactEmail" TEXT,
    "defaultTipAmountsCents" INTEGER[] DEFAULT ARRAY[200, 500, 1000, 2000]::INTEGER[],
    "brandPrimaryColor" TEXT,
    "brandSecondaryColor" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Song_songDatabaseId_idx" ON "Song"("songDatabaseId");

-- CreateIndex
CREATE INDEX "Song_songDatabaseId_artist_idx" ON "Song"("songDatabaseId", "artist");

-- CreateIndex
CREATE INDEX "Song_songDatabaseId_decade_idx" ON "Song"("songDatabaseId", "decade");

-- CreateIndex
CREATE UNIQUE INDEX "Request_stripePaymentIntentId_key" ON "Request"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "Request_songDatabaseId_status_idx" ON "Request"("songDatabaseId", "status");

-- CreateIndex
CREATE INDEX "Request_status_songDatabaseId_requestedAt_idx" ON "Request"("status", "songDatabaseId", "requestedAt");

-- CreateIndex
CREATE INDEX "SearchLog_createdAt_idx" ON "SearchLog"("createdAt");

-- CreateIndex
CREATE INDEX "SearchLog_songDatabaseId_createdAt_idx" ON "SearchLog"("songDatabaseId", "createdAt");

-- CreateIndex
CREATE INDEX "SearchLog_searchTerm_idx" ON "SearchLog"("searchTerm");

-- AddForeignKey
ALTER TABLE "Song" ADD CONSTRAINT "Song_songDatabaseId_fkey" FOREIGN KEY ("songDatabaseId") REFERENCES "SongDatabase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_songDatabaseId_fkey" FOREIGN KEY ("songDatabaseId") REFERENCES "SongDatabase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchLog" ADD CONSTRAINT "SearchLog_songDatabaseId_fkey" FOREIGN KEY ("songDatabaseId") REFERENCES "SongDatabase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-written additions (not expressible in schema.prisma under Prisma 7 —
-- extensions and typed/partial indexes are no longer schema-declarable).
-- Reviewer note: future `prisma migrate dev` schema diffs won't know about
-- these, since nothing in schema.prisma references them. Always inspect a
-- newly generated migration before applying it, to make sure it doesn't try
-- to drop them.

-- EnableExtension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram indexes for fast fuzzy/typo-tolerant song search
CREATE INDEX "song_name_trgm_idx" ON "Song" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "song_artist_trgm_idx" ON "Song" USING GIN ("artist" gin_trgm_ops);

-- Partial index: keeps Live Queue reads O(active queue size) regardless of
-- how large Request history grows, since PLAYED/DELETED rows never match
-- the WHERE clause and so never bloat this index.
CREATE INDEX "live_queue_idx" ON "Request" ("tipAmountCents" DESC, "requestedAt" ASC)
  WHERE "status" = 'QUEUED';
