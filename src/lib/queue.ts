import { prisma } from "@/lib/prisma";

export type PublicQueueItem = {
  id: string;
  songName: string;
  artistName: string;
};

// Public payload only — never requesterName, wantsShoutOut, tipAmountCents, or any
// Stripe/payment field. Sort key: confirmed tips first (highest first), then
// untipped requests by request time. See prisma/migrations .../migration.sql
// for the partial index (`live_queue_idx`) that keeps this fast regardless of
// how large Request history grows.
export async function getPublicQueue(songDatabaseId: string): Promise<PublicQueueItem[]> {
  const requests = await prisma.request.findMany({
    where: { songDatabaseId, status: "QUEUED" },
    orderBy: [{ tipAmountCents: "desc" }, { requestedAt: "asc" }],
    select: { id: true, songName: true, artistName: true },
  });
  return requests;
}

export type AdminQueueItem = {
  id: string;
  songName: string;
  artistName: string;
  requesterName: string;
  wantsShoutOut: boolean;
  tipAmountCents: number;
  paymentStatus: string;
  requestedAt: Date;
};

// Full fields — admin/dashboard use only (protected by src/proxy.ts). Same
// sort key as the public queue.
export async function getAdminQueue(songDatabaseId: string): Promise<AdminQueueItem[]> {
  const requests = await prisma.request.findMany({
    where: { songDatabaseId, status: "QUEUED" },
    orderBy: [{ tipAmountCents: "desc" }, { requestedAt: "asc" }],
    select: {
      id: true,
      songName: true,
      artistName: true,
      requesterName: true,
      wantsShoutOut: true,
      tipAmountCents: true,
      paymentStatus: true,
      requestedAt: true,
    },
  });
  return requests;
}
