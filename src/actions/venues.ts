"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { broadcastQueueChanged } from "@/lib/supabase/server";
import { getActiveSongDatabaseId } from "@/lib/settings";
import { assertOwnsVenue, requirePerformer } from "@/lib/auth";

export async function createVenue(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Venue name is required");
  const performer = await requirePerformer();

  await prisma.venue.create({ data: { performerId: performer.id, name } });
  revalidatePath("/dashboard/bangers");
}

export async function renameVenue(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) throw new Error("id and name are required");
  const performer = await requirePerformer();

  await prisma.venue.updateMany({ where: { id, performerId: performer.id }, data: { name } });
  revalidatePath("/dashboard/bangers");
}

// Bangers cascade with the venue (see BangerSong.venue onDelete: Cascade)
// — no separate history/audit concern the way Request has with
// SongDatabase, so no extra guard needed here.
export async function deleteVenue(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("id is required");
  const performer = await requirePerformer();

  await prisma.venue.deleteMany({ where: { id, performerId: performer.id } });
  // Settings.currentVenueId isn't an FK (see schema comment) — if this was
  // the current venue, it's left pointing at nothing, which getBangerKeys
  // already treats as "no venue selected" (empty list), so no cleanup
  // needed for correctness. Still clear it so the Live Queue's selector
  // doesn't show a stale name.
  await prisma.settings.updateMany({
    where: { performerId: performer.id, currentVenueId: id },
    data: { currentVenueId: null },
  });

  revalidatePath("/dashboard/bangers");
  revalidatePath("/dashboard/queue");
}

// Selected directly from the Live Queue's venue dropdown — persisted so it
// doesn't reset if the page reloads mid-gig, and broadcast so an already-
// open Live Queue tab picks up the new venue's Bangers list live.
export async function setCurrentVenue(formData: FormData) {
  const venueId = String(formData.get("venueId") ?? "") || null;
  const performer = await requirePerformer();
  if (venueId) await assertOwnsVenue(performer.id, venueId);

  await prisma.settings.upsert({
    where: { performerId: performer.id },
    update: { currentVenueId: venueId },
    create: { performerId: performer.id, currentVenueId: venueId },
  });

  revalidatePath("/dashboard/queue");
  revalidatePath("/dashboard/bangers");
  const activeSongDatabaseId = await getActiveSongDatabaseId(performer.id);
  if (activeSongDatabaseId) await broadcastQueueChanged(activeSongDatabaseId);
}
