-- Keys per instrument (existing rows become guitar) + guitar capo fret. Additive apart from the unique index swap.
ALTER TABLE "SongKey" ADD COLUMN "instrument" TEXT NOT NULL DEFAULT 'guitar', ADD COLUMN "capo" TEXT;
DROP INDEX "SongKey_performerId_songName_artistName_key";
CREATE UNIQUE INDEX "SongKey_performerId_instrument_songName_artistName_key" ON "SongKey"("performerId", "instrument", "songName", "artistName");
