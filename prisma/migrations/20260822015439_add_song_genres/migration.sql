-- Hand-written (see prisma/migrations/20260807010226_init/migration.sql and
-- README "Database notes" for why: `prisma migrate dev` couldn't be used
-- here — it needs a shadow database, and replaying
-- 20260817090000_enable_row_level_security against a fresh shadow DB fails
-- (ALTER TABLE ... ENABLE ROW LEVEL SECURITY on "_prisma_migrations" itself
-- trips up the shadow DB's own migration bookkeeping). `prisma migrate
-- deploy` applies this directly without a shadow DB, same as production.
ALTER TABLE "Song" ADD COLUMN "genres" TEXT[] NOT NULL DEFAULT '{}';
