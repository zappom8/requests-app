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
export async function activateBangerMode(songDatabaseId: string, venueId: string | null) {
  if (!venueId) return;

  const bangers = await prisma.bangerSong.findMany({ where: { venueId } });
  if (bangers.length === 0) return;

  for (const banger of bangers) {
    const song = await prisma.song.findFirst({
      where: { songDatabaseId, name: banger.songName, artist: banger.artistName },
    });
    if (!song) continue;

    const alreadyQueued = await prisma.request.findFirst({
      where: { songDatabaseId, songId: song.id, status: "QUEUED" },
      select: { id: true },
    });
    if (alreadyQueued) continue;

    await prisma.request.create({
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
