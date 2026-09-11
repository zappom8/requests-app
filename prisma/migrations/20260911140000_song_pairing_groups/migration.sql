-- Hand-written for the same reason as 20260822015439_add_song_genres (see
-- its comment and README "Database notes"): `prisma migrate dev` needs a
-- shadow database, and replaying 20260817090000_enable_row_level_security
-- against a fresh shadow DB fails. Apply with `prisma migrate deploy`, same
-- as production.
--
-- Replaces the directional, pairwise SongPairing table with a group model:
-- any number of songs can share a groupId, and requesting one auto-queues
-- every other member — giving bidirectional pairing (and beyond, for 3+
-- songs) instead of requiring a separate row for each direction.

-- CreateTable
CREATE TABLE "SongPairingGroupMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "songName" TEXT NOT NULL,
    "artistName" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SongPairingGroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SongPairingGroupMember_groupId_songName_artistName_key" ON "SongPairingGroupMember"("groupId", "songName", "artistName");
CREATE INDEX "SongPairingGroupMember_groupId_idx" ON "SongPairingGroupMember"("groupId");
CREATE INDEX "SongPairingGroupMember_songName_artistName_idx" ON "SongPairingGroupMember"("songName", "artistName");

-- Data migration: every existing directional SongPairing row becomes its
-- own 2-member group (the old row's own id becomes the new group's
-- groupId), preserving any pairing already created through the dashboard.
INSERT INTO "SongPairingGroupMember" ("id", "groupId", "songName", "artistName", "createdAt")
SELECT gen_random_uuid()::text, "id", "fromSongName", "fromArtistName", "createdAt" FROM "SongPairing"
UNION ALL
SELECT gen_random_uuid()::text, "id", "toSongName", "toArtistName", "createdAt" FROM "SongPairing";

-- DropTable
DROP TABLE "SongPairing";

-- RLS: same default-deny posture as every other public table.
ALTER TABLE "SongPairingGroupMember" ENABLE ROW LEVEL SECURITY;
