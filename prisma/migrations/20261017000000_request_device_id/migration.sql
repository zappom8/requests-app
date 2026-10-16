-- Anonymous per-device id on each request, so a repeat request for the same
-- song from the same device can be blocked/ignored in stats. Additive only.
ALTER TABLE "Request" ADD COLUMN "deviceId" TEXT;
CREATE INDEX "Request_deviceId_songId_requestedAt_idx" ON "Request"("deviceId", "songId", "requestedAt");
