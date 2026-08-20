import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

export type DateRange = { from: Date; to: Date; daysOfWeek?: number[] };

// daysOfWeek entries are 0 (Sunday) .. 6 (Saturday), matching Postgres's
// EXTRACT(DOW). Invalid/out-of-range values are dropped rather than
// throwing, since this only ever comes from a query string.
export function resolveDateRange(dateFrom?: string, dateTo?: string, days?: string[]): DateRange {
  const daysOfWeek = days
    ?.map((d) => Number(d))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  return {
    from: dateFrom ? new Date(`${dateFrom}T00:00:00`) : new Date(0),
    to: dateTo ? new Date(`${dateTo}T23:59:59.999`) : new Date(),
    ...(daysOfWeek && daysOfWeek.length > 0 ? { daysOfWeek } : {}),
  };
}

// Appended to a raw query's WHERE clause after the requestedAt BETWEEN
// condition. Empty fragment when no day-of-week filter is active.
function dowFilter(daysOfWeek: number[] | undefined) {
  if (!daysOfWeek || daysOfWeek.length === 0) return Prisma.sql``;
  return Prisma.sql`AND EXTRACT(DOW FROM "requestedAt")::int IN (${Prisma.join(daysOfWeek)})`;
}

export type Overview = {
  totalRequests: number;
  totalTipCents: number;
  tippedRequestCount: number;
  averageTipCents: number;
};

export async function getOverview({ from, to, daysOfWeek }: DateRange): Promise<Overview> {
  const rows = await prisma.$queryRaw<
    { totalRequests: bigint; totalTipCents: bigint | null; tippedRequestCount: bigint }[]
  >(Prisma.sql`
    SELECT
      COUNT(*) AS "totalRequests",
      SUM(CASE WHEN "tipAmountCents" > 0 THEN "tipAmountCents" ELSE 0 END) AS "totalTipCents",
      COUNT(*) FILTER (WHERE "tipAmountCents" > 0) AS "tippedRequestCount"
    FROM "Request"
    WHERE "requestedAt" BETWEEN ${from} AND ${to} ${dowFilter(daysOfWeek)}
  `);

  const row = rows[0];
  const totalRequests = Number(row?.totalRequests ?? 0);
  const totalTipCents = Number(row?.totalTipCents ?? 0);
  const tippedRequestCount = Number(row?.tippedRequestCount ?? 0);

  return {
    totalRequests,
    totalTipCents,
    tippedRequestCount,
    averageTipCents: tippedRequestCount > 0 ? Math.round(totalTipCents / tippedRequestCount) : 0,
  };
}

export type RankedSong = { songName: string; artistName: string; value: number };

export async function getMostRequestedSongs({ from, to, daysOfWeek }: DateRange, limit = 10): Promise<RankedSong[]> {
  const rows = await prisma.$queryRaw<{ songName: string; artistName: string; value: bigint }[]>(Prisma.sql`
    SELECT "songName", "artistName", COUNT(*) AS value
    FROM "Request"
    WHERE "requestedAt" BETWEEN ${from} AND ${to} ${dowFilter(daysOfWeek)}
    GROUP BY "songName", "artistName"
    ORDER BY value DESC
    LIMIT ${limit}
  `);
  return rows.map((r) => ({ ...r, value: Number(r.value) }));
}

export async function getMostProfitableSongs(
  { from, to, daysOfWeek }: DateRange,
  limit = 10
): Promise<RankedSong[]> {
  const rows = await prisma.$queryRaw<{ songName: string; artistName: string; value: bigint }[]>(Prisma.sql`
    SELECT "songName", "artistName", SUM("tipAmountCents") AS value
    FROM "Request"
    WHERE "requestedAt" BETWEEN ${from} AND ${to} ${dowFilter(daysOfWeek)}
    GROUP BY "songName", "artistName"
    HAVING SUM("tipAmountCents") > 0
    ORDER BY value DESC
    LIMIT ${limit}
  `);
  return rows.map((r) => ({ ...r, value: Number(r.value) }));
}

export async function getTopTippingSongsByAverage(
  { from, to, daysOfWeek }: DateRange,
  limit = 10
): Promise<RankedSong[]> {
  const rows = await prisma.$queryRaw<{ songName: string; artistName: string; value: number }[]>(Prisma.sql`
    SELECT "songName", "artistName", ROUND(AVG("tipAmountCents")) AS value
    FROM "Request"
    WHERE "requestedAt" BETWEEN ${from} AND ${to} AND "tipAmountCents" > 0 ${dowFilter(daysOfWeek)}
    GROUP BY "songName", "artistName"
    ORDER BY value DESC
    LIMIT ${limit}
  `);
  return rows.map((r) => ({ ...r, value: Number(r.value) }));
}

export type RankedLabel = { label: string; value: number };

export async function getMostRequestedArtists(
  { from, to, daysOfWeek }: DateRange,
  limit = 10
): Promise<RankedLabel[]> {
  const rows = await prisma.$queryRaw<{ label: string; value: bigint }[]>(Prisma.sql`
    SELECT "artistName" AS label, COUNT(*) AS value
    FROM "Request"
    WHERE "requestedAt" BETWEEN ${from} AND ${to} ${dowFilter(daysOfWeek)}
    GROUP BY "artistName"
    ORDER BY value DESC
    LIMIT ${limit}
  `);
  return rows.map((r) => ({ ...r, value: Number(r.value) }));
}

export async function getMostRequestedDecades({ from, to, daysOfWeek }: DateRange): Promise<RankedLabel[]> {
  const rows = await prisma.$queryRaw<{ label: string; value: bigint }[]>(Prisma.sql`
    SELECT COALESCE("decade", 'Unknown') AS label, COUNT(*) AS value
    FROM "Request"
    WHERE "requestedAt" BETWEEN ${from} AND ${to} ${dowFilter(daysOfWeek)}
    GROUP BY label
    ORDER BY value DESC
  `);
  return rows.map((r) => ({ ...r, value: Number(r.value) }));
}

export async function getMostRequestedDatabases({ from, to, daysOfWeek }: DateRange): Promise<RankedLabel[]> {
  const rows = await prisma.$queryRaw<{ label: string; value: bigint }[]>(Prisma.sql`
    SELECT sd.name AS label, COUNT(*) AS value
    FROM "Request" r
    JOIN "SongDatabase" sd ON sd.id = r."songDatabaseId"
    WHERE r."requestedAt" BETWEEN ${from} AND ${to} ${dowFilter(daysOfWeek)}
    GROUP BY sd.name
    ORDER BY value DESC
  `);
  return rows.map((r) => ({ ...r, value: Number(r.value) }));
}

export type MonthlyPoint = { month: string; requests: number; tipCents: number };

export async function getMonthly({ from, to, daysOfWeek }: DateRange): Promise<MonthlyPoint[]> {
  const rows = await prisma.$queryRaw<{ month: Date; requests: bigint; tipcents: bigint }[]>(Prisma.sql`
    SELECT date_trunc('month', "requestedAt") AS month, COUNT(*) AS requests, SUM("tipAmountCents") AS tipcents
    FROM "Request"
    WHERE "requestedAt" BETWEEN ${from} AND ${to} ${dowFilter(daysOfWeek)}
    GROUP BY month
    ORDER BY month ASC
  `);
  return rows.map((r) => ({
    month: r.month.toLocaleDateString([], { year: "numeric", month: "short" }),
    requests: Number(r.requests),
    tipCents: Number(r.tipcents ?? 0),
  }));
}

export const DOW_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export async function getRequestsByDayOfWeek({ from, to, daysOfWeek }: DateRange): Promise<RankedLabel[]> {
  const rows = await prisma.$queryRaw<{ dow: number; value: bigint }[]>(Prisma.sql`
    SELECT EXTRACT(DOW FROM "requestedAt")::int AS dow, COUNT(*) AS value
    FROM "Request"
    WHERE "requestedAt" BETWEEN ${from} AND ${to} ${dowFilter(daysOfWeek)}
    GROUP BY dow
    ORDER BY value DESC
  `);
  return rows.map((r) => ({ label: DOW_LABELS[r.dow], value: Number(r.value) }));
}

export async function getRequestsByHour({ from, to, daysOfWeek }: DateRange): Promise<RankedLabel[]> {
  const rows = await prisma.$queryRaw<{ hour: number; value: bigint }[]>(Prisma.sql`
    SELECT EXTRACT(HOUR FROM "requestedAt")::int AS hour, COUNT(*) AS value
    FROM "Request"
    WHERE "requestedAt" BETWEEN ${from} AND ${to} ${dowFilter(daysOfWeek)}
    GROUP BY hour
    ORDER BY value DESC
  `);
  return rows.map((r) => ({ label: `${r.hour}:00`, value: Number(r.value) }));
}
