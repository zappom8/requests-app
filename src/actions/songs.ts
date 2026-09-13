"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { parseSongsCsv } from "@/lib/csv";

export async function createSong(formData: FormData) {
  const songDatabaseId = String(formData.get("songDatabaseId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const artist = String(formData.get("artist") ?? "").trim();
  const decade = String(formData.get("decade") ?? "").trim() || null;

  if (!songDatabaseId || !name || !artist) {
    throw new Error("songDatabaseId, name, and artist are required");
  }

  await prisma.song.create({ data: { songDatabaseId, name, artist, decade } });
  revalidatePath(`/dashboard/databases/${songDatabaseId}`);
}

export async function updateSong(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const songDatabaseId = String(formData.get("songDatabaseId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const artist = String(formData.get("artist") ?? "").trim();
  const decade = String(formData.get("decade") ?? "").trim() || null;

  if (!id || !name || !artist) throw new Error("name and artist are required");

  await prisma.song.update({ where: { id }, data: { name, artist, decade } });
  revalidatePath(`/dashboard/databases/${songDatabaseId}`);
}

export async function deleteSong(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const songDatabaseId = String(formData.get("songDatabaseId") ?? "");
  if (!id) throw new Error("id is required");

  await prisma.song.delete({ where: { id } });
  revalidatePath(`/dashboard/databases/${songDatabaseId}`);
}

// Replace semantics (locked decision): the uploaded CSV becomes the new full
// song list for this database — anything not in the CSV is removed.
export async function importSongsCsv(formData: FormData) {
  const songDatabaseId = String(formData.get("songDatabaseId") ?? "");
  const file = formData.get("file") as File | null;
  if (!songDatabaseId || !file) throw new Error("songDatabaseId and file are required");

  const text = await file.text();
  const songs = parseSongsCsv(text);
  if (songs.length === 0) throw new Error("No valid rows found in that CSV.");

  await prisma.$transaction([
    prisma.song.deleteMany({ where: { songDatabaseId } }),
    prisma.song.createMany({
      data: songs.map((s) => ({ songDatabaseId, name: s.name, artist: s.artist, decade: s.decade })),
    }),
  ]);

  revalidatePath(`/dashboard/databases/${songDatabaseId}`);
}
