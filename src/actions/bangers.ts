"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export type SongRef = { songName: string; artistName: string };

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
