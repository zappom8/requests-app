-- Hand-written for the same reason as 20260822015439_add_song_genres (see
-- its comment and README "Database notes"): `prisma migrate dev` needs a
-- shadow database, and replaying 20260817090000_enable_row_level_security
-- against a fresh shadow DB fails. Apply with `prisma migrate deploy`, same
-- as production.
--
-- Fixes a real bug: SearchLog -> SongDatabase was ON DELETE RESTRICT, so
-- deleting a Song Database with any search history (unrelated to whether it
-- has real Request history, which is deliberately still protected) threw a
-- foreign-key violation from inside the deleteSongDatabase Server Action.
-- In production that thrown error got redacted by Next's Server Action
-- error handling down to "Minified React error #441", with no indication
-- of the real cause. Search logs are disposable analytics, not an audit
-- trail like Request, so they cascade instead of blocking the delete.
ALTER TABLE "SearchLog" DROP CONSTRAINT "SearchLog_songDatabaseId_fkey";
ALTER TABLE "SearchLog" ADD CONSTRAINT "SearchLog_songDatabaseId_fkey" FOREIGN KEY ("songDatabaseId") REFERENCES "SongDatabase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
