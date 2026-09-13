"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function addBanger(formData: FormData) {
  const venueId = String(formData.get("venueId") ?? "");
  const songName = String(formData.get("songName") ?? "").trim();
  const artistName = String(formData.get("artistName") ?? "").trim();
  if (!venueId || !songName || !artistName) throw new Error("A venue and song are required");

  await prisma.bangerSong.upsert({
    where: { venueId_songName_artistName: { venueId, songName, artistName } },
    create: { venueId, songName, artistName },
    update: {},
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
