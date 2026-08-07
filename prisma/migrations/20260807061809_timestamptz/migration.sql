-- Fixes a real bug: TIMESTAMP (without time zone) columns stored naive
-- wall-clock values. Prisma-written rows were self-consistent (always
-- written/read as UTC through Prisma), but anything else touching the DB
-- directly with `now()` (this session's own SQL testing, or any future ad
-- hoc query) got the *local* wall-clock time instead, silently shifting
-- those rows by the server's UTC offset — caught via Statistics/History
-- date-range filtering incorrectly excluding a row. TIMESTAMPTZ stores an
-- unambiguous absolute instant regardless of how a row gets inserted.
--
-- `AT TIME ZONE 'UTC'` on the way in tells Postgres "the existing naive
-- values are already UTC" (true for all real Prisma-written data) rather
-- than reinterpreting them using the session's local timezone, which would
-- silently corrupt every existing correct timestamp.
--
-- Note: this migration does NOT touch the hand-written trigram/partial
-- indexes below — Prisma's own diff (this file started life as its output)
-- proposed dropping them since nothing in schema.prisma references them;
-- those DROP INDEX statements were removed. Standing README warning
-- applies to every future generated migration too.

ALTER TABLE "Request"
  ALTER COLUMN "requestedAt" TYPE TIMESTAMPTZ(3) USING "requestedAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "playedAt" TYPE TIMESTAMPTZ(3) USING "playedAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "deletedAt" TYPE TIMESTAMPTZ(3) USING "deletedAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

ALTER TABLE "SearchLog"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';

ALTER TABLE "Settings"
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

ALTER TABLE "Song"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

ALTER TABLE "SongDatabase"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';
