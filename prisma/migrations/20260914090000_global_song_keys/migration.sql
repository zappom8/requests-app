-- Hand-written for the same reason as 20260822015439_add_song_genres (see
-- its comment and README "Database notes"): `prisma migrate dev` needs a
-- shadow database, and replaying 20260817090000_enable_row_level_security
-- against a fresh shadow DB fails. Apply with `prisma migrate deploy`, same
-- as production.
--
-- Moves song keys off the per-database Song row (added in
-- 20260913150000_add_song_keys) onto a global-by-name+artist SongKey
-- table, same reasoning as SongPairingGroupMember/BangerSong: a song's key
-- doesn't depend on which database's set list it's catalogued in.

-- CreateTable
CREATE TABLE "SongKey" (
    "id" TEXT NOT NULL,
    "songName" TEXT NOT NULL,
    "artistName" TEXT NOT NULL,
    "originalKey" TEXT,
    "lochiesKey" TEXT,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SongKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SongKey_songName_artistName_key" ON "SongKey"("songName", "artistName");

-- Data migration: carry over any key data already entered via the
-- per-database Song columns (collapsing duplicates across databases —
-- MAX() picks one non-null value per name+artist if they somehow differed).
INSERT INTO "SongKey" ("id", "songName", "artistName", "originalKey", "lochiesKey", "updatedAt")
SELECT gen_random_uuid()::text, "name", "artist", MAX("originalKey"), MAX("lochiesKey"), now()
FROM "Song"
WHERE "originalKey" IS NOT NULL OR "lochiesKey" IS NOT NULL
GROUP BY "name", "artist";

-- AlterTable
ALTER TABLE "Song" DROP COLUMN "originalKey",
DROP COLUMN "lochiesKey";

-- RLS: same default-deny posture as every other public table.
ALTER TABLE "SongKey" ENABLE ROW LEVEL SECURITY;
