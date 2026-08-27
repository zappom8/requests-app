-- Hand-written for the same reason as 20260822015439_add_song_genres:
-- `prisma migrate dev` can't run here (its shadow database fails replaying
-- 20260817090000_enable_row_level_security). `prisma migrate deploy` applies
-- this directly, no shadow DB involved.

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN "gigTitleFilters" TEXT[] NOT NULL DEFAULT '{}';
