-- Venue auto-selection from the gigs calendar + per-venue statistics.
-- Additive only: new nullable/defaulted columns, no existing data changes.

ALTER TABLE "Venue" ADD COLUMN "calendarKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "isBusking" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Request" ADD COLUMN "venueId" TEXT;
ALTER TABLE "SearchLog" ADD COLUMN "venueId" TEXT;
ALTER TABLE "Settings" ADD COLUMN "currentVenueManualAt" TIMESTAMPTZ(3);

CREATE INDEX "Request_venueId_requestedAt_idx" ON "Request"("venueId", "requestedAt");
CREATE INDEX "SearchLog_venueId_createdAt_idx" ON "SearchLog"("venueId", "createdAt");

ALTER TABLE "Request" ADD CONSTRAINT "Request_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SearchLog" ADD CONSTRAINT "SearchLog_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
