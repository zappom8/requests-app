-- Hand-written for the same reason as prisma/migrations/20260822015439_add_song_genres
-- (see its comment and README "Database notes"): `prisma migrate dev` needs
-- a shadow database, and replaying 20260817090000_enable_row_level_security
-- against a fresh shadow DB fails (ALTER TABLE ... ENABLE ROW LEVEL
-- SECURITY on "_prisma_migrations" itself trips up the shadow DB's own
-- migration bookkeeping). Apply with `prisma migrate deploy`, same as
-- production.

-- AlterTable
ALTER TABLE "Request" ADD COLUMN     "isPairedAddition" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "triggeredByRequestId" TEXT;

-- CreateTable: SongPairing is global (by song name+artist), not scoped to
-- one SongDatabase — the same physical song is a separate Song row (with a
-- different id) in every database that includes it, and a pairing rule
-- should apply everywhere that song shows up. This also means a pairing
-- survives a CSV replace, since it isn't tied to any Song id at all.
CREATE TABLE "SongPairing" (
    "id" TEXT NOT NULL,
    "fromSongName" TEXT NOT NULL,
    "fromArtistName" TEXT NOT NULL,
    "toSongName" TEXT NOT NULL,
    "toArtistName" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SongPairing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Request_triggeredByRequestId_idx" ON "Request"("triggeredByRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "SongPairing_fromSongName_fromArtistName_toSongName_toArti_key" ON "SongPairing"("fromSongName", "fromArtistName", "toSongName", "toArtistName");

-- CreateIndex
CREATE INDEX "SongPairing_fromSongName_fromArtistName_idx" ON "SongPairing"("fromSongName", "fromArtistName");

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_triggeredByRequestId_fkey" FOREIGN KEY ("triggeredByRequestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: new table needs the same default-deny posture as every other public
-- table (see 20260817090000_enable_row_level_security) — app connects as
-- table owner (exempt from RLS), this only closes Supabase's separate
-- public REST/GraphQL API.
ALTER TABLE "SongPairing" ENABLE ROW LEVEL SECURITY;
