import { prisma } from "@/lib/prisma";

export type PublicQueueItem = {
  id: string;
  songName: string;
  artistName: string;
};

// Public payload only — never requesterName, wantsShoutOut, tipAmountCents, or any
// payment-provider field. Sort key: confirmed tips first (highest first), then
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
  requestIds: string[];
  songName: string;
  artistName: string;
  requesterName: string;
  otherRequesterCount: number;
  wantsShoutOut: boolean;
  tipAmountCents: number;
  paymentStatus: string;
  requestedAt: Date;
};

// Full fields — admin/dashboard use only (protected by src/proxy.ts). Two or
// more still-queued requests for the same song (by songId, falling back to
// name+artist for the rare case a catalog song was deleted mid-queue) are
// merged into a single entry: "requested by X and N others". The merged
// entry's effective tip is the highest among the group (so one tipper still
// pulls the whole group into the tipped tier), and within a tip tier, more
// requesters means higher priority — this is what pushes a popular untipped
// song to the top of the untipped section.
export async function getAdminQueue(songDatabaseId: string): Promise<AdminQueueItem[]> {
  const requests = await prisma.request.findMany({
    where: { songDatabaseId, status: "QUEUED" },
    select: {
      id: true,
      songId: true,
      songName: true,
      artistName: true,
      requesterName: true,
      wantsShoutOut: true,
      tipAmountCents: true,
      paymentStatus: true,
      requestedAt: true,
    },
  });

  const groups = new Map<string, typeof requests>();
  for (const r of requests) {
    const key = r.songId ?? `name:${r.songName}::${r.artistName}`;
    const group = groups.get(key);
    if (group) group.push(r);
    else groups.set(key, [r]);
  }

  const items: AdminQueueItem[] = Array.from(groups.values()).map((group) => {
    // Highest tip first, then earliest request — this member becomes the
    // "primary" requester shown, and its tip/payment status represents the group.
    const [primary] = [...group].sort(
      (a, b) => b.tipAmountCents - a.tipAmountCents || a.requestedAt.getTime() - b.requestedAt.getTime()
    );
    const earliestRequestedAt = group.reduce(
      (min, r) => (r.requestedAt < min ? r.requestedAt : min),
      group[0].requestedAt
    );

    return {
      id: primary.id,
      requestIds: group.map((r) => r.id),
      songName: primary.songName,
      artistName: primary.artistName,
      requesterName: primary.requesterName,
      otherRequesterCount: group.length - 1,
      wantsShoutOut: group.some((r) => r.wantsShoutOut),
      tipAmountCents: primary.tipAmountCents,
      paymentStatus: primary.paymentStatus,
      requestedAt: earliestRequestedAt,
    };
  });

  items.sort(
    (a, b) =>
      b.tipAmountCents - a.tipAmountCents ||
      b.otherRequesterCount - a.otherRequesterCount ||
      a.requestedAt.getTime() - b.requestedAt.getTime()
  );

  return items;
}
