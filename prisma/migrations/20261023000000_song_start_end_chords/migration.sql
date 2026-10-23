-- "Starts on" / "Ends on" chords for planning transitions between songs. Additive only.
ALTER TABLE "SongKey" ADD COLUMN "startChord" TEXT, ADD COLUMN "endChord" TEXT;
