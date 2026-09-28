-- Hand-written for the same reason as 20260822015439_add_song_genres (see
-- its comment and README "Database notes"): `prisma migrate dev` needs a
-- shadow database, and replaying 20260817090000_enable_row_level_security
-- against a fresh shadow DB fails. Apply with `prisma migrate deploy`, same
-- as production.
--
-- Live score control: forScore URL-scheme links per song, performer devices
-- (iPhone controller / iPad forScore receiver), and the command log.
-- Additive only — safe to apply before the code that uses it is deployed.

-- CreateTable
CREATE TABLE "ForScoreLink" (
    "id" TEXT NOT NULL,
    "performerId" TEXT NOT NULL,
    "songName" TEXT NOT NULL,
    "artistName" TEXT NOT NULL,
    "title" TEXT,
    "filename" TEXT,
    "setlist" TEXT,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ForScoreLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformerDevice" (
    "id" TEXT NOT NULL,
    "performerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "channelToken" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PerformerDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceCommand" (
    "id" TEXT NOT NULL,
    "performerId" TEXT NOT NULL,
    "targetDeviceId" TEXT NOT NULL,
    "sourceDeviceId" TEXT,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMPTZ(3),

    CONSTRAINT "DeviceCommand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ForScoreLink_performerId_songName_artistName_key" ON "ForScoreLink"("performerId", "songName", "artistName");

-- CreateIndex
CREATE UNIQUE INDEX "PerformerDevice_channelToken_key" ON "PerformerDevice"("channelToken");

-- CreateIndex
CREATE INDEX "PerformerDevice_performerId_role_idx" ON "PerformerDevice"("performerId", "role");

-- CreateIndex
CREATE INDEX "DeviceCommand_targetDeviceId_createdAt_idx" ON "DeviceCommand"("targetDeviceId", "createdAt");

-- AddForeignKey
ALTER TABLE "ForScoreLink" ADD CONSTRAINT "ForScoreLink_performerId_fkey" FOREIGN KEY ("performerId") REFERENCES "Performer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformerDevice" ADD CONSTRAINT "PerformerDevice_performerId_fkey" FOREIGN KEY ("performerId") REFERENCES "Performer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceCommand" ADD CONSTRAINT "DeviceCommand_performerId_fkey" FOREIGN KEY ("performerId") REFERENCES "Performer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceCommand" ADD CONSTRAINT "DeviceCommand_targetDeviceId_fkey" FOREIGN KEY ("targetDeviceId") REFERENCES "PerformerDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: same default-deny posture as every other public table.
ALTER TABLE "ForScoreLink" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PerformerDevice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DeviceCommand" ENABLE ROW LEVEL SECURITY;
