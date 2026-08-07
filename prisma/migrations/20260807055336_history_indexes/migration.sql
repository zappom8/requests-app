-- Hand-written (see README.md "Database notes" — Prisma 7 can't declare
-- these in schema.prisma, and its diff will propose dropping them on every
-- future migration since nothing in schema.prisma references them; always
-- review a generated migration before applying).

-- Supports Request History's default "all statuses, newest first" sort
-- without a status/database filter narrowing it first.
CREATE INDEX "request_requested_at_idx" ON "Request" ("requestedAt" DESC);

-- Fuzzy/typo-tolerant song and artist search in Request History, matching
-- the same approach used for live song search (src/lib/search.ts).
CREATE INDEX "request_song_name_trgm_idx" ON "Request" USING GIN ("songName" gin_trgm_ops);
CREATE INDEX "request_artist_name_trgm_idx" ON "Request" USING GIN ("artistName" gin_trgm_ops);
