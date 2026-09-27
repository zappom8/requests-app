-- Hand-written for the same reason as 20260822015439_add_song_genres (see
-- its comment and README "Database notes"): `prisma migrate dev` needs a
-- shadow database, and replaying 20260817090000_enable_row_level_security
-- against a fresh shadow DB fails. Apply with `prisma migrate deploy`, same
-- as production.

-- CreateTable
CREATE TABLE "ForScoreProgram" (
    "id" TEXT NOT NULL,
    "library" TEXT NOT NULL,
    "songName" TEXT NOT NULL,
    "artistName" TEXT NOT NULL,
    "program" INTEGER NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ForScoreProgram_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ForScoreProgram_program_check" CHECK ("program" BETWEEN 0 AND 127)
);

-- CreateIndex
CREATE UNIQUE INDEX "ForScoreProgram_library_songName_artistName_key" ON "ForScoreProgram"("library", "songName", "artistName");

-- CreateIndex
CREATE UNIQUE INDEX "ForScoreProgram_library_program_key" ON "ForScoreProgram"("library", "program");

-- RLS: same default-deny posture as every other public table.
ALTER TABLE "ForScoreProgram" ENABLE ROW LEVEL SECURITY;
