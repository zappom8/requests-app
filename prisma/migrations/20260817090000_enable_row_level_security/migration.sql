-- Enables RLS on every public table with no permissive policies (default
-- deny). The app itself connects via DATABASE_URL as the table owner, which
-- Postgres always exempts from RLS, so this has zero effect on the app's
-- own Prisma queries -- it only closes off Supabase's separate public
-- REST/GraphQL API (which authenticates as the non-owner anon/authenticated
-- roles), which this app never intentionally exposes any table through.
ALTER TABLE "Request" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SearchLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Song" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SongDatabase" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
