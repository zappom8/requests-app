-- The receivers' long-poll only runs while this is in the future (set when the Live Queue
-- is opened) or a calendar gig window is open — keeps idle polling from using up free-tier memory.
ALTER TABLE "Settings" ADD COLUMN "liveControlActiveUntil" TIMESTAMPTZ(3);
