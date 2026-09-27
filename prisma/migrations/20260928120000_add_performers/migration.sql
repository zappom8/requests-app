-- Hand-written for the same reason as 20260822015439_add_song_genres (see
-- its comment and README "Database notes"): `prisma migrate dev` needs a
-- shadow database, and replaying 20260817090000_enable_row_level_security
-- against a fresh shadow DB fails. Apply with `prisma migrate deploy`, same
-- as production. Generated from `prisma migrate diff`, minus its proposed
-- drops of the hand-written trigram/partial indexes, plus the backfill.
--
-- Multi-performer foundation: every catalog/config table gets an owning
-- Performer. Everything that exists today belongs to Lochie, so he's
-- created here as the first performer and every existing row is assigned
-- to him before the new columns become NOT NULL. His login (authUserId)
-- is linked afterwards by prisma/performers.ts — it lives in Supabase
-- Auth, which local dev's plain Postgres doesn't have.

-- CreateTable
CREATE TABLE "Performer" (
    "id" TEXT NOT NULL,
    "authUserId" TEXT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Performer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Performer_authUserId_key" ON "Performer"("authUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Performer_slug_key" ON "Performer"("slug");

-- Lochie, owner of all existing data.
INSERT INTO "Performer" ("id", "slug", "name", "updatedAt") VALUES ('performer_lochie', 'lochie', 'Lochie', now());

-- AlterTable + backfill: add each owner column nullable, assign every
-- existing row to Lochie, then make it required.
ALTER TABLE "SongDatabase" ADD COLUMN "performerId" TEXT;
UPDATE "SongDatabase" SET "performerId" = 'performer_lochie';
ALTER TABLE "SongDatabase" ALTER COLUMN "performerId" SET NOT NULL;

ALTER TABLE "SongPairingGroupMember" ADD COLUMN "performerId" TEXT;
UPDATE "SongPairingGroupMember" SET "performerId" = 'performer_lochie';
ALTER TABLE "SongPairingGroupMember" ALTER COLUMN "performerId" SET NOT NULL;

ALTER TABLE "Venue" ADD COLUMN "performerId" TEXT;
UPDATE "Venue" SET "performerId" = 'performer_lochie';
ALTER TABLE "Venue" ALTER COLUMN "performerId" SET NOT NULL;

ALTER TABLE "SongKey" ADD COLUMN "performerId" TEXT;
UPDATE "SongKey" SET "performerId" = 'performer_lochie';
ALTER TABLE "SongKey" ALTER COLUMN "performerId" SET NOT NULL;

ALTER TABLE "BookingInquiry" ADD COLUMN "performerId" TEXT;
UPDATE "BookingInquiry" SET "performerId" = 'performer_lochie';
ALTER TABLE "BookingInquiry" ALTER COLUMN "performerId" SET NOT NULL;

-- ForScoreProgram: the per-library scoping becomes per-performer (the only
-- library so far, "Footdrums", is Lochie's).
ALTER TABLE "ForScoreProgram" ADD COLUMN "performerId" TEXT;
UPDATE "ForScoreProgram" SET "performerId" = 'performer_lochie';
ALTER TABLE "ForScoreProgram" ALTER COLUMN "performerId" SET NOT NULL;
DROP INDEX "ForScoreProgram_library_program_key";
DROP INDEX "ForScoreProgram_library_songName_artistName_key";
ALTER TABLE "ForScoreProgram" DROP COLUMN "library";

-- Settings: from an id=1 singleton to one row per performer. The existing
-- row (if any) becomes Lochie's; ids now come from a sequence.
INSERT INTO "Settings" ("id", "updatedAt") VALUES (1, now()) ON CONFLICT ("id") DO NOTHING;
ALTER TABLE "Settings" ADD COLUMN "performerId" TEXT;
UPDATE "Settings" SET "performerId" = 'performer_lochie' WHERE "id" = 1;
DELETE FROM "Settings" WHERE "performerId" IS NULL;
ALTER TABLE "Settings" ALTER COLUMN "performerId" SET NOT NULL;
CREATE SEQUENCE settings_id_seq;
ALTER TABLE "Settings" ALTER COLUMN "id" SET DEFAULT nextval('settings_id_seq');
ALTER SEQUENCE settings_id_seq OWNED BY "Settings"."id";
SELECT setval('settings_id_seq', (SELECT MAX("id") FROM "Settings"));

-- SongKey uniqueness is now per performer.
DROP INDEX "SongKey_songName_artistName_key";

-- Pairing lookups now always filter by performer too.
DROP INDEX "SongPairingGroupMember_songName_artistName_idx";

-- Booking inquiries are always listed per performer.
DROP INDEX "BookingInquiry_status_createdAt_idx";

-- CreateIndex
CREATE INDEX "BookingInquiry_performerId_status_createdAt_idx" ON "BookingInquiry"("performerId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ForScoreProgram_performerId_songName_artistName_key" ON "ForScoreProgram"("performerId", "songName", "artistName");

-- CreateIndex
CREATE UNIQUE INDEX "ForScoreProgram_performerId_program_key" ON "ForScoreProgram"("performerId", "program");

-- CreateIndex
CREATE UNIQUE INDEX "Settings_performerId_key" ON "Settings"("performerId");

-- CreateIndex
CREATE INDEX "SongDatabase_performerId_idx" ON "SongDatabase"("performerId");

-- CreateIndex
CREATE UNIQUE INDEX "SongKey_performerId_songName_artistName_key" ON "SongKey"("performerId", "songName", "artistName");

-- CreateIndex
CREATE INDEX "SongPairingGroupMember_performerId_songName_artistName_idx" ON "SongPairingGroupMember"("performerId", "songName", "artistName");

-- CreateIndex
CREATE INDEX "Venue_performerId_idx" ON "Venue"("performerId");

-- AddForeignKey
ALTER TABLE "SongDatabase" ADD CONSTRAINT "SongDatabase_performerId_fkey" FOREIGN KEY ("performerId") REFERENCES "Performer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SongPairingGroupMember" ADD CONSTRAINT "SongPairingGroupMember_performerId_fkey" FOREIGN KEY ("performerId") REFERENCES "Performer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venue" ADD CONSTRAINT "Venue_performerId_fkey" FOREIGN KEY ("performerId") REFERENCES "Performer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SongKey" ADD CONSTRAINT "SongKey_performerId_fkey" FOREIGN KEY ("performerId") REFERENCES "Performer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForScoreProgram" ADD CONSTRAINT "ForScoreProgram_performerId_fkey" FOREIGN KEY ("performerId") REFERENCES "Performer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settings" ADD CONSTRAINT "Settings_performerId_fkey" FOREIGN KEY ("performerId") REFERENCES "Performer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingInquiry" ADD CONSTRAINT "BookingInquiry_performerId_fkey" FOREIGN KEY ("performerId") REFERENCES "Performer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS: same default-deny posture as every other public table.
ALTER TABLE "Performer" ENABLE ROW LEVEL SECURITY;
