import { prisma } from "@/lib/prisma";

type GroupedRequest = {
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

// Two or more still-queued requests for the same song (by songId, falling
// back to name+artist for the rare case a catalog song was deleted mid-
// queue) are merged into a single entry. The merged entry's effective tip
// is the highest among the group (so one tipper still pulls the whole group
// into the tipped tier), and within a tip tier, more requesters means
// higher priority — this is what pushes a popular untipped song to the top
// of the untipped section. Shared by both the public and admin queue views
// so their ordering (and grouping) always agree — only the fields each one
// is allowed to expose differ.
async function getGroupedQueue(songDatabaseId: string): Promise<GroupedRequest[]> {
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

  const items: GroupedRequest[] = Array.from(groups.values()).map((group) => {
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

export type PublicQueueItem = {
  id: string;
  songName: string;
  artistName: string;
  requestCount: number;
};

// Public payload only — never requesterName, wantsShoutOut, tipAmountCents,
// paymentStatus, or any payment-provider field. requestCount is safe to
// show (just "N people requested this"), no names attached.
export async function getPublicQueue(songDatabaseId: string): Promise<PublicQueueItem[]> {
  const groups = await getGroupedQueue(songDatabaseId);
  return groups.map((g) => ({
    id: g.requestIds[0],
    songName: g.songName,
    artistName: g.artistName,
    requestCount: g.requestIds.length,
  }));
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

// Full fields — admin/dashboard use only (protected by src/proxy.ts).
export async function getAdminQueue(songDatabaseId: string): Promise<AdminQueueItem[]> {
  const groups = await getGroupedQueue(songDatabaseId);
  return groups.map((g) => ({
    id: g.requestIds[0],
    requestIds: g.requestIds,
    songName: g.songName,
    artistName: g.artistName,
    requesterName: g.requesterName,
    otherRequesterCount: g.otherRequesterCount,
    wantsShoutOut: g.wantsShoutOut,
    tipAmountCents: g.tipAmountCents,
    paymentStatus: g.paymentStatus,
    requestedAt: g.requestedAt,
  }));
}
