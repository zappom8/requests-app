"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { broadcastQueueChanged } from "@/lib/supabase/server";

export type SongRef = { songName: string; artistName: string };

// requesterName shown on the Live Queue for Banger Mode additions — fixed
// rather than blank, so it's obviously not a real request and stays
// filterable in History/Payments, matching the "Auto-paired" convention
// for pairing additions.
const BANGER_ADDITION_REQUESTER_NAME = "Banger Mode";

// Fires when Banger Mode is switched on (see LiveQueueList's B shortcut):
// queues every song on the current venue's Bangers list that isn't
// already queued, as a real Request row so it gets normal PLAY/DELETE —
// flagged isBangerAddition so it's excluded from Statistics/the recently-
// played prompt and never shown on the public /queue page (see
// getPublicQueue's filter in src/lib/queue.ts). A banger not in this
// database's own catalog is silently skipped, same as a pairing target
// that isn't catalogued — nothing to point a songId at.
//
// Bangers that also belong to the same Song Pairing group collapse into
// one queue card instead of separate ones — one becomes the primary
// (isBangerAddition), the rest link to it via triggeredByRequestId exactly
// like a real pairing trigger, reusing getGroupedQueue's existing "Also
// cues" folding. A 30-song banger list with several 2-3 song pairing
// groups then shows as maybe a dozen cards instead of thirty, which is the
// point — a long list is unusable as a one-card-per-song wall on a phone
// screen mid-gig.
//
// Batched into a handful of round trips rather than looping per banger
// (findFirst + findFirst + create each) — that version took seconds for
// even a modest list, long enough that the broadcast at the end fired well
// after the DJ had already given up and refreshed the page, or pressed B
// again, launching a second overlapping pass that could double-queue
// songs the first pass hadn't committed yet.
export async function activateBangerMode(songDatabaseId: string, venueId: string | null) {
  if (!venueId) return;

  const [bangers, catalogSongs, queuedRequests] = await Promise.all([
    prisma.bangerSong.findMany({ where: { venueId } }),
    prisma.song.findMany({ where: { songDatabaseId } }),
    prisma.request.findMany({ where: { songDatabaseId, status: "QUEUED" }, select: { songId: true } }),
  ]);
  if (bangers.length === 0) return;

  const catalogByKey = new Map(catalogSongs.map((s) => [`${s.name}::${s.artist}`, s]));
  const queuedSongIds = new Set(queuedRequests.map((r) => r.songId).filter((id): id is string => id !== null));

  const eligible = bangers
    .map((b) => catalogByKey.get(`${b.songName}::${b.artistName}`))
    .filter((song): song is (typeof catalogSongs)[number] => !!song && !queuedSongIds.has(song.id));
  if (eligible.length === 0) return;

  const eligibleKeys = new Set(eligible.map((s) => `${s.name}::${s.artist}`));
  const songByKey = new Map(eligible.map((s) => [`${s.name}::${s.artist}`, s]));

  // Cluster eligible bangers that share a pairing group (union-find over
  // song keys) — a banger with no pairing, or whose pairing partners
  // aren't also bangers right now, just ends up alone in its own cluster.
  const memberships = await prisma.songPairingGroupMember.findMany({
    where: { OR: eligible.map((s) => ({ songName: s.name, artistName: s.artist })) },
  });
  const bangerKeysByGroup = new Map<string, string[]>();
  for (const m of memberships) {
    const key = `${m.songName}::${m.artistName}`;
    if (!eligibleKeys.has(key)) continue;
    const arr = bangerKeysByGroup.get(m.groupId);
    if (arr) arr.push(key);
    else bangerKeysByGroup.set(m.groupId, [key]);
  }

  const parent = new Map<string, string>(eligible.map((s) => [`${s.name}::${s.artist}`, `${s.name}::${s.artist}`]));
  function find(key: string): string {
    let root = key;
    while (parent.get(root) !== root) root = parent.get(root)!;
    parent.set(key, root);
    return root;
  }
  function union(a: string, b: string) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  }
  for (const keysInGroup of bangerKeysByGroup.values()) {
    for (let i = 1; i < keysInGroup.length; i++) union(keysInGroup[0], keysInGroup[i]);
  }

  const clusters = new Map<string, string[]>();
  for (const key of eligibleKeys) {
    const root = find(key);
    const arr = clusters.get(root);
    if (arr) arr.push(key);
    else clusters.set(root, [key]);
  }

  // One primary Request per cluster — needs its own id before the linked
  // rows can be created, so these go one at a time rather than batched
  // (still just one per cluster, not one per banger).
  const primaryIdByCluster = new Map<string, string>();
  await Promise.all(
    [...clusters.entries()].map(async ([root, keys]) => {
      const song = songByKey.get(keys[0])!;
      const primary = await prisma.request.create({
        data: {
          songDatabaseId,
          songId: song.id,
          songName: song.name,
          artistName: song.artist,
          decade: song.decade,
          requesterName: BANGER_ADDITION_REQUESTER_NAME,
          isBangerAddition: true,
        },
      });
      primaryIdByCluster.set(root, primary.id);
    })
  );

  const linkedRows = [...clusters.entries()].flatMap(([root, keys]) =>
    keys.slice(1).map((key) => {
      const song = songByKey.get(key)!;
      return {
        songDatabaseId,
        songId: song.id,
        songName: song.name,
        artistName: song.artist,
        decade: song.decade,
        requesterName: BANGER_ADDITION_REQUESTER_NAME,
        isPairedAddition: true,
        triggeredByRequestId: primaryIdByCluster.get(root)!,
      };
    })
  );
  if (linkedRows.length > 0) {
    await prisma.request.createMany({ data: linkedRows });
  }

  revalidatePath("/dashboard/queue");
  await broadcastQueueChanged(songDatabaseId);
}

// Bulk add — the picker lets you check off any number of songs and add
// them all in one go, since adding a venue's whole hype list one song at a
// time was too slow. skipDuplicates makes this a safe no-op for anything
// already on the list rather than an error.
export async function addBangers(formData: FormData) {
  const venueId = String(formData.get("venueId") ?? "");
  const songs = JSON.parse(String(formData.get("songs") ?? "[]")) as SongRef[];
  const valid = songs.filter((s) => s.songName?.trim() && s.artistName?.trim());
  if (!venueId || valid.length === 0) throw new Error("A venue and at least one song are required");

  await prisma.bangerSong.createMany({
    data: valid.map((s) => ({ venueId, songName: s.songName.trim(), artistName: s.artistName.trim() })),
    skipDuplicates: true,
  });

  revalidatePath("/dashboard/bangers");
  revalidatePath("/dashboard/queue");
}

export async function removeBanger(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("id is required");

  await prisma.bangerSong.delete({ where: { id } });

  revalidatePath("/dashboard/bangers");
  revalidatePath("/dashboard/queue");
}
