import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { DateRange } from "@/lib/statistics";

export type SearchRanked = { term: string; count: number };

// Our search box doesn't distinguish "searching for a song" vs "searching
// for an artist" intent (it's one unified field) — so unlike the spec's
// separate "most searched songs" / "most searched artists", this reports a
// single "most searched terms" ranking. Faithful to how the actual UI works
// rather than guessing at song-vs-artist intent from free text.
export async function getMostSearchedTerms({ from, to }: DateRange, limit = 20): Promise<SearchRanked[]> {
  const rows = await prisma.$queryRaw<{ term: string; count: bigint }[]>(Prisma.sql`
    SELECT LOWER("searchTerm") AS term, COUNT(*) AS count
    FROM "SearchLog"
    WHERE "createdAt" BETWEEN ${from} AND ${to}
    GROUP BY term
    ORDER BY count DESC
    LIMIT ${limit}
  `);
  return rows.map((r) => ({ term: r.term, count: Number(r.count) }));
}

export async function getMostUnsuccessfulSearches({ from, to }: DateRange, limit = 20): Promise<SearchRanked[]> {
  const rows = await prisma.$queryRaw<{ term: string; count: bigint }[]>(Prisma.sql`
    SELECT LOWER("searchTerm") AS term, COUNT(*) AS count
    FROM "SearchLog"
    WHERE "createdAt" BETWEEN ${from} AND ${to} AND "resultsFound" = false
    GROUP BY term
    ORDER BY count DESC
    LIMIT ${limit}
  `);
  return rows.map((r) => ({ term: r.term, count: Number(r.count) }));
}

export async function getSearchTotals({ from, to }: DateRange): Promise<{ total: number; unsuccessful: number }> {
  const [total, unsuccessful] = await Promise.all([
    prisma.searchLog.count({ where: { createdAt: { gte: from, lte: to } } }),
    prisma.searchLog.count({ where: { createdAt: { gte: from, lte: to }, resultsFound: false } }),
  ]);
  return { total, unsuccessful };
}
