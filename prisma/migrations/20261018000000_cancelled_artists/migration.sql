-- "Cancelled artists": artists temporarily hidden from the request page and
-- the banger features (songs stay in the database). Additive only.
ALTER TABLE "Settings" ADD COLUMN "cancelledArtists" TEXT[] DEFAULT ARRAY[]::TEXT[];
