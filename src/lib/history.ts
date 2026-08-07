import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { RequestStatus } from "@/generated/prisma/client";

export const HISTORY_PAGE_SIZE = 30;

export type HistoryFilters = {
  song?: string;
  artist?: string;
  status?: RequestStatus;
  songDatabaseId?: string;
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string; // YYYY-MM-DD
  tip?: "any" | "tipped" | "untipped";
};

export type HistoryItem = {
  id: string;
  songName: string;
  artistName: string;
  requesterName: string;
  billingName: string | null;
  wantsShoutOut: boolean;
  status: RequestStatus;
  requestedAt: Date;
  tipAmountCents: number;
  paymentStatus: string;
  databaseName: string;
};

function buildWhere(filters: HistoryFilters): Prisma.RequestWhereInput {
  const where: Prisma.RequestWhereInput = {};

  if (filters.song?.trim()) {
    where.songName = { contains: filters.song.trim(), mode: "insensitive" };
  }
  if (filters.artist?.trim()) {
    where.artistName = { contains: filters.artist.trim(), mode: "insensitive" };
  }
  if (filters.status) where.status = filters.status;
  if (filters.songDatabaseId) where.songDatabaseId = filters.songDatabaseId;
  if (filters.tip === "tipped") where.tipAmountCents = { gt: 0 };
  if (filters.tip === "untipped") where.tipAmountCents = 0;

  if (filters.dateFrom || filters.dateTo) {
    where.requestedAt = {
      ...(filters.dateFrom ? { gte: new Date(`${filters.dateFrom}T00:00:00`) } : {}),
      ...(filters.dateTo ? { lte: new Date(`${filters.dateTo}T23:59:59.999`) } : {}),
    };
  }

  return where;
}

export async function getRequestHistory(
  filters: HistoryFilters,
  cursor: string | null
): Promise<{ items: HistoryItem[]; nextCursor: string | null }> {
  const where = buildWhere(filters);

  const requests = await prisma.request.findMany({
    where,
    orderBy: [{ requestedAt: "desc" }, { id: "desc" }],
    take: HISTORY_PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      songName: true,
      artistName: true,
      requesterName: true,
      billingName: true,
      wantsShoutOut: true,
      status: true,
      requestedAt: true,
      tipAmountCents: true,
      paymentStatus: true,
      songDatabase: { select: { name: true } },
    },
  });

  const hasMore = requests.length > HISTORY_PAGE_SIZE;
  const page = hasMore ? requests.slice(0, HISTORY_PAGE_SIZE) : requests;

  return {
    items: page.map((r) => ({
      id: r.id,
      songName: r.songName,
      artistName: r.artistName,
      requesterName: r.requesterName,
      billingName: r.billingName,
      wantsShoutOut: r.wantsShoutOut,
      status: r.status,
      requestedAt: r.requestedAt,
      tipAmountCents: r.tipAmountCents,
      paymentStatus: r.paymentStatus,
      databaseName: r.songDatabase.name,
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  };
}
