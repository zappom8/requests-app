-- Hand-written for the same reason as 20260822015439_add_song_genres (see
-- its comment and README "Database notes"): `prisma migrate dev` needs a
-- shadow database, and replaying 20260817090000_enable_row_level_security
-- against a fresh shadow DB fails. Apply with `prisma migrate deploy`, same
-- as production.

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN "currentVenueId" TEXT;

-- CreateTable
CREATE TABLE "Venue" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BangerSong" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "songName" TEXT NOT NULL,
    "artistName" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BangerSong_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BangerSong_venueId_songName_artistName_key" ON "BangerSong"("venueId", "songName", "artistName");
CREATE INDEX "BangerSong_venueId_idx" ON "BangerSong"("venueId");

-- AddForeignKey
ALTER TABLE "BangerSong" ADD CONSTRAINT "BangerSong_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: same default-deny posture as every other public table.
ALTER TABLE "Venue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BangerSong" ENABLE ROW LEVEL SECURITY;
