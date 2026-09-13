"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { broadcastQueueChanged } from "@/lib/supabase/server";
import { getActiveSongDatabaseId } from "@/lib/settings";

export async function createVenue(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Venue name is required");

  await prisma.venue.create({ data: { name } });
  revalidatePath("/dashboard/bangers");
}

export async function renameVenue(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) throw new Error("id and name are required");

  await prisma.venue.update({ where: { id }, data: { name } });
  revalidatePath("/dashboard/bangers");
}

// Bangers cascade with the venue (see BangerSong.venue onDelete: Cascade)
// — no separate history/audit concern the way Request has with
// SongDatabase, so no extra guard needed here.
export async function deleteVenue(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("id is required");

  await prisma.venue.delete({ where: { id } });
  // Settings.currentVenueId isn't an FK (see schema comment) — if this was
  // the current venue, it's left pointing at nothing, which getBangerKeys
  // already treats as "no venue selected" (empty list), so no cleanup
  // needed for correctness. Still clear it so the Live Queue's selector
  // doesn't show a stale name.
  await prisma.settings.updateMany({ where: { id: 1, currentVenueId: id }, data: { currentVenueId: null } });

  revalidatePath("/dashboard/bangers");
  revalidatePath("/dashboard/queue");
}

// Selected directly from the Live Queue's venue dropdown — persisted so it
// doesn't reset if the page reloads mid-gig, and broadcast so an already-
// open Live Queue tab picks up the new venue's Bangers list live.
export async function setCurrentVenue(formData: FormData) {
  const venueId = String(formData.get("venueId") ?? "") || null;

  await prisma.settings.upsert({
    where: { id: 1 },
    update: { currentVenueId: venueId },
    create: { id: 1, currentVenueId: venueId },
  });

  revalidatePath("/dashboard/queue");
  revalidatePath("/dashboard/bangers");
  const activeSongDatabaseId = await getActiveSongDatabaseId();
  if (activeSongDatabaseId) await broadcastQueueChanged(activeSongDatabaseId);
}
