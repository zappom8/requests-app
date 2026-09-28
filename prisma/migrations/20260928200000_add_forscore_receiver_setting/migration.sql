-- Hand-written for the same reason as 20260822015439_add_song_genres (see
-- its comment and README "Database notes"). Additive only — apply before
-- deploying the code that reads it (every Settings read selects it).

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN "forScoreReceiverId" TEXT;
