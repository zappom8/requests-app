import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { DateRange } from "@/lib/statistics";

export type SearchRanked = { term: string; count: number };

// Same fixed-offset reasoning as statistics.ts's localRequestedAt — Brisbane
// never observes DST, so this is safe year-round without the DB session's
// own (UTC, on Vercel) timezone leaking into "day of week".
const LOCAL_TZ = "Australia/Brisbane";
const localCreatedAt = Prisma.sql`("createdAt" AT TIME ZONE ${LOCAL_TZ})`;

function dowFilter(daysOfWeek: number[] | undefined) {
  if (!daysOfWeek || daysOfWeek.length === 0) return Prisma.sql``;
  return Prisma.sql`AND EXTRACT(DOW FROM ${localCreatedAt})::int IN (${Prisma.join(daysOfWeek)})`;
}

// Our search box doesn't distinguish "searching for a song" vs "searching
// for an artist" intent (it's one unified field) — so unlike the spec's
// separate "most searched songs" / "most searched artists", this reports a
// single "most searched terms" ranking. Faithful to how the actual UI works
// rather than guessing at song-vs-artist intent from free text.
export async function getMostSearchedTerms({ from, to, daysOfWeek }: DateRange, limit = 20): Promise<SearchRanked[]> {
  const rows = await prisma.$queryRaw<{ term: string; count: bigint }[]>(Prisma.sql`
    SELECT LOWER("searchTerm") AS term, COUNT(*) AS count
    FROM "SearchLog"
    WHERE "createdAt" BETWEEN ${from} AND ${to} ${dowFilter(daysOfWeek)}
    GROUP BY term
    ORDER BY count DESC
    LIMIT ${limit}
  `);
  return rows.map((r) => ({ term: r.term, count: Number(r.count) }));
}

export async function getMostUnsuccessfulSearches(
  { from, to, daysOfWeek }: DateRange,
  limit = 20
): Promise<SearchRanked[]> {
  const rows = await prisma.$queryRaw<{ term: string; count: bigint }[]>(Prisma.sql`
    SELECT LOWER("searchTerm") AS term, COUNT(*) AS count
    FROM "SearchLog"
    WHERE "createdAt" BETWEEN ${from} AND ${to} AND "resultsFound" = false ${dowFilter(daysOfWeek)}
    GROUP BY term
    ORDER BY count DESC
    LIMIT ${limit}
  `);
  return rows.map((r) => ({ term: r.term, count: Number(r.count) }));
}

export async function getSearchTotals({ from, to, daysOfWeek }: DateRange): Promise<{ total: number; unsuccessful: number }> {
  const rows = await prisma.$queryRaw<{ total: bigint; unsuccessful: bigint }[]>(Prisma.sql`
    SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE "resultsFound" = false) AS unsuccessful
    FROM "SearchLog"
    WHERE "createdAt" BETWEEN ${from} AND ${to} ${dowFilter(daysOfWeek)}
  `);
  const row = rows[0];
  return { total: Number(row?.total ?? 0), unsuccessful: Number(row?.unsuccessful ?? 0) };
}

export type SearchLogRow = { searchTerm: string; resultsFound: boolean; eventType: string; createdAt: Date };

// Raw, per-search rows for the full CSV export (not aggregated like the
// ranked lists above) — every logged search in range, newest first.
export async function getSearchLogsForExport({ from, to, daysOfWeek }: DateRange): Promise<SearchLogRow[]> {
  return prisma.$queryRaw<SearchLogRow[]>(Prisma.sql`
    SELECT "searchTerm", "resultsFound", "eventType", "createdAt"
    FROM "SearchLog"
    WHERE "createdAt" BETWEEN ${from} AND ${to} ${dowFilter(daysOfWeek)}
    ORDER BY "createdAt" DESC
  `);
}
