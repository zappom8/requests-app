-- Hand-written for the same reason as 20260822015439_add_song_genres:
-- `prisma migrate dev` can't run here (its shadow database fails replaying
-- 20260817090000_enable_row_level_security). `prisma migrate deploy` applies
-- this directly, no shadow DB involved.

-- CreateEnum
CREATE TYPE "InquiryStatus" AS ENUM ('NEW', 'CONTACTED', 'CLOSED');

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN "gigsCalendarUrls" TEXT[] NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "BookingInquiry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "eventDate" TEXT,
    "location" TEXT,
    "message" TEXT NOT NULL,
    "status" "InquiryStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingInquiry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookingInquiry_status_createdAt_idx" ON "BookingInquiry"("status", "createdAt");

-- RowLevelSecurity: same default-deny posture as 20260817090000 for every
-- other table (see that migration's comment) -- this table is new so it
-- needs the same treatment, not covered by the earlier blanket migration.
ALTER TABLE "BookingInquiry" ENABLE ROW LEVEL SECURITY;
