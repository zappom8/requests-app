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
  isFiller: boolean;
  isPairedAddition: boolean;
  triggeredByRequestId: string | null;
  linkedSongs: LinkedSong[];
};

export type LinkedSong = { songName: string; artistName: string };

// Lochie sometimes adds requests under this name himself to keep the queue
// moving during dead air — those should never outrank a real audience
// request, tipped or not, so they're sorted to the back regardless of the
// usual tip/popularity/time ordering. A group only counts as filler when
// every requester in it used this name; a real listener requesting the same
// song puts it back in normal contention.
const FILLER_REQUESTER_NAME = "zappo";

function isFillerName(name: string): boolean {
  return name.trim().toLowerCase() === FILLER_REQUESTER_NAME;
}

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
      isPairedAddition: true,
      triggeredByRequestId: true,
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
    // A real request landing on a song that's already queued as a pure
    // auto-paired addition merges into this same group (same songId) — but
    // the auto-added row was never a real ask, so once real demand exists
    // it must never count toward "how many people want this" or backdate
    // the request to whenever the pairing fired, or it silently jumps the
    // queue ahead of songs only one real person asked for. Every stat below
    // is computed from real members when there are any; the auto-added
    // row's id still rides along in requestIds so resolving the real
    // request also resolves it, just with zero influence on ordering.
    const realMembers = group.filter((r) => !r.isPairedAddition);
    const statsGroup = realMembers.length > 0 ? realMembers : group;

    // Highest tip first, then earliest request — this member becomes the
    // "primary" requester shown, and its tip/payment status represents the group.
    const [primary] = [...statsGroup].sort(
      (a, b) => b.tipAmountCents - a.tipAmountCents || a.requestedAt.getTime() - b.requestedAt.getTime()
    );
    const earliestRequestedAt = statsGroup.reduce(
      (min, r) => (r.requestedAt < min ? r.requestedAt : min),
      statsGroup[0].requestedAt
    );

    return {
      requestIds: group.map((r) => r.id),
      songName: primary.songName,
      artistName: primary.artistName,
      requesterName: primary.requesterName,
      otherRequesterCount: statsGroup.length - 1,
      wantsShoutOut: statsGroup.some((r) => r.wantsShoutOut),
      tipAmountCents: primary.tipAmountCents,
      paymentStatus: primary.paymentStatus,
      requestedAt: earliestRequestedAt,
      isFiller: statsGroup.every((r) => isFillerName(r.requesterName)),
      isPairedAddition: realMembers.length === 0,
      // Representative only — real (non-paired) groups never read this, and
      // a paired group is a single SongPairing target, so its members (if
      // ever more than one, e.g. a rare create race) all point at the same trigger.
      triggeredByRequestId: group[0].triggeredByRequestId,
      linkedSongs: [],
    };
  });

  // A song that's purely the result of a pairing (never a real request in
  // its own right) doesn't get its own Live Queue card — it's folded into
  // the card of whichever request triggered it, as a linked-song tab, and
  // its request id(s) ride along so marking the trigger PLAYED/DELETEd
  // resolves both together (see markPlayed/deleteRequest in
  // src/actions/queue.ts, which already take an id array for exactly this
  // kind of "resolve as one unit" grouping).
  const primaryItems = items.filter((i) => !i.isPairedAddition);
  const pairedItems = items.filter((i) => i.isPairedAddition);

  for (const paired of pairedItems) {
    const triggerPrimary = paired.triggeredByRequestId
      ? primaryItems.find((p) => p.requestIds.includes(paired.triggeredByRequestId!))
      : undefined;
    // Orphaned (trigger no longer queued, e.g. resolved through some other
    // path) — drop it rather than surface a linked song with nothing to
    // attach to.
    if (!triggerPrimary) continue;

    triggerPrimary.linkedSongs.push({ songName: paired.songName, artistName: paired.artistName });
    triggerPrimary.requestIds = [...triggerPrimary.requestIds, ...paired.requestIds];
  }

  primaryItems.sort(
    (a, b) =>
      Number(a.isFiller) - Number(b.isFiller) ||
      b.tipAmountCents - a.tipAmountCents ||
      b.otherRequesterCount - a.otherRequesterCount ||
      a.requestedAt.getTime() - b.requestedAt.getTime()
  );

  return primaryItems;
}

export type PublicQueueItem = {
  id: string;
  songName: string;
  artistName: string;
};

// Public payload only — never requesterName, wantsShoutOut, tipAmountCents,
// paymentStatus, or any payment-provider field. Deliberately omits how many
// people requested a song too, even though it's grouped/boosted the same
// way the admin queue is — showing that number would invite people to spam
// requests for a song just to watch (and inflate) the count. Linked/paired
// songs are internal queue-management detail, also omitted here.
export async function getPublicQueue(songDatabaseId: string): Promise<PublicQueueItem[]> {
  const groups = await getGroupedQueue(songDatabaseId);
  return groups.map((g) => ({
    id: g.requestIds[0],
    songName: g.songName,
    artistName: g.artistName,
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
  linkedSongs: LinkedSong[];
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
    linkedSongs: g.linkedSongs,
  }));
}
