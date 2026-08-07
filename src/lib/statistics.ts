import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

export type DateRange = { from: Date; to: Date };

export function resolveDateRange(dateFrom?: string, dateTo?: string): DateRange {
  return {
    from: dateFrom ? new Date(`${dateFrom}T00:00:00`) : new Date(0),
    to: dateTo ? new Date(`${dateTo}T23:59:59.999`) : new Date(),
  };
}

export type Overview = {
  totalRequests: number;
  totalTipCents: number;
  tippedRequestCount: number;
  averageTipCents: number;
};

export async function getOverview({ from, to }: DateRange): Promise<Overview> {
  const [totalRequests, tipAgg] = await Promise.all([
    prisma.request.count({ where: { requestedAt: { gte: from, lte: to } } }),
    prisma.request.aggregate({
      where: { requestedAt: { gte: from, lte: to }, tipAmountCents: { gt: 0 } },
      _sum: { tipAmountCents: true },
      _count: true,
    }),
  ]);

  const totalTipCents = tipAgg._sum.tipAmountCents ?? 0;
  const tippedRequestCount = tipAgg._count;

  return {
    totalRequests,
    totalTipCents,
    tippedRequestCount,
    averageTipCents: tippedRequestCount > 0 ? Math.round(totalTipCents / tippedRequestCount) : 0,
  };
}

export type RankedSong = { songName: string; artistName: string; value: number };

export async function getMostRequestedSongs({ from, to }: DateRange, limit = 10): Promise<RankedSong[]> {
  const rows = await prisma.$queryRaw<{ songName: string; artistName: string; value: bigint }[]>(Prisma.sql`
    SELECT "songName", "artistName", COUNT(*) AS value
    FROM "Request"
    WHERE "requestedAt" BETWEEN ${from} AND ${to}
    GROUP BY "songName", "artistName"
    ORDER BY value DESC
    LIMIT ${limit}
  `);
  return rows.map((r) => ({ ...r, value: Number(r.value) }));
}

export async function getMostProfitableSongs({ from, to }: DateRange, limit = 10): Promise<RankedSong[]> {
  const rows = await prisma.$queryRaw<{ songName: string; artistName: string; value: bigint }[]>(Prisma.sql`
    SELECT "songName", "artistName", SUM("tipAmountCents") AS value
    FROM "Request"
    WHERE "requestedAt" BETWEEN ${from} AND ${to}
    GROUP BY "songName", "artistName"
    HAVING SUM("tipAmountCents") > 0
    ORDER BY value DESC
    LIMIT ${limit}
  `);
  return rows.map((r) => ({ ...r, value: Number(r.value) }));
}

export async function getTopTippingSongsByAverage({ from, to }: DateRange, limit = 10): Promise<RankedSong[]> {
  const rows = await prisma.$queryRaw<{ songName: string; artistName: string; value: number }[]>(Prisma.sql`
    SELECT "songName", "artistName", ROUND(AVG("tipAmountCents")) AS value
    FROM "Request"
    WHERE "requestedAt" BETWEEN ${from} AND ${to} AND "tipAmountCents" > 0
    GROUP BY "songName", "artistName"
    ORDER BY value DESC
    LIMIT ${limit}
  `);
  return rows.map((r) => ({ ...r, value: Number(r.value) }));
}

export type RankedLabel = { label: string; value: number };

export async function getMostRequestedArtists({ from, to }: DateRange, limit = 10): Promise<RankedLabel[]> {
  const rows = await prisma.$queryRaw<{ label: string; value: bigint }[]>(Prisma.sql`
    SELECT "artistName" AS label, COUNT(*) AS value
    FROM "Request"
    WHERE "requestedAt" BETWEEN ${from} AND ${to}
    GROUP BY "artistName"
    ORDER BY value DESC
    LIMIT ${limit}
  `);
  return rows.map((r) => ({ ...r, value: Number(r.value) }));
}

export async function getMostRequestedDecades({ from, to }: DateRange): Promise<RankedLabel[]> {
  const rows = await prisma.$queryRaw<{ label: string; value: bigint }[]>(Prisma.sql`
    SELECT COALESCE("decade", 'Unknown') AS label, COUNT(*) AS value
    FROM "Request"
    WHERE "requestedAt" BETWEEN ${from} AND ${to}
    GROUP BY label
    ORDER BY value DESC
  `);
  return rows.map((r) => ({ ...r, value: Number(r.value) }));
}

export async function getMostRequestedDatabases({ from, to }: DateRange): Promise<RankedLabel[]> {
  const rows = await prisma.$queryRaw<{ label: string; value: bigint }[]>(Prisma.sql`
    SELECT sd.name AS label, COUNT(*) AS value
    FROM "Request" r
    JOIN "SongDatabase" sd ON sd.id = r."songDatabaseId"
    WHERE r."requestedAt" BETWEEN ${from} AND ${to}
    GROUP BY sd.name
    ORDER BY value DESC
  `);
  return rows.map((r) => ({ ...r, value: Number(r.value) }));
}

export type MonthlyPoint = { month: string; requests: number; tipCents: number };

export async function getMonthly({ from, to }: DateRange): Promise<MonthlyPoint[]> {
  const rows = await prisma.$queryRaw<{ month: Date; requests: bigint; tipcents: bigint }[]>(Prisma.sql`
    SELECT date_trunc('month', "requestedAt") AS month, COUNT(*) AS requests, SUM("tipAmountCents") AS tipcents
    FROM "Request"
    WHERE "requestedAt" BETWEEN ${from} AND ${to}
    GROUP BY month
    ORDER BY month ASC
  `);
  return rows.map((r) => ({
    month: r.month.toLocaleDateString([], { year: "numeric", month: "short" }),
    requests: Number(r.requests),
    tipCents: Number(r.tipcents ?? 0),
  }));
}

const DOW_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export async function getRequestsByDayOfWeek({ from, to }: DateRange): Promise<RankedLabel[]> {
  const rows = await prisma.$queryRaw<{ dow: number; value: bigint }[]>(Prisma.sql`
    SELECT EXTRACT(DOW FROM "requestedAt")::int AS dow, COUNT(*) AS value
    FROM "Request"
    WHERE "requestedAt" BETWEEN ${from} AND ${to}
    GROUP BY dow
    ORDER BY dow ASC
  `);
  return rows.map((r) => ({ label: DOW_LABELS[r.dow], value: Number(r.value) }));
}

export async function getRequestsByHour({ from, to }: DateRange): Promise<RankedLabel[]> {
  const rows = await prisma.$queryRaw<{ hour: number; value: bigint }[]>(Prisma.sql`
    SELECT EXTRACT(HOUR FROM "requestedAt")::int AS hour, COUNT(*) AS value
    FROM "Request"
    WHERE "requestedAt" BETWEEN ${from} AND ${to}
    GROUP BY hour
    ORDER BY hour ASC
  `);
  return rows.map((r) => ({ label: `${r.hour}:00`, value: Number(r.value) }));
}
