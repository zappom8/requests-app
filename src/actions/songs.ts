"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { parseSongsCsv } from "@/lib/csv";
import { assertOwnsDatabase, assertOwnsDatabases, requirePerformer } from "@/lib/auth";

export async function createSong(formData: FormData) {
  const songDatabaseId = String(formData.get("songDatabaseId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const artist = String(formData.get("artist") ?? "").trim();
  const decade = String(formData.get("decade") ?? "").trim() || null;

  if (!songDatabaseId || !name || !artist) {
    throw new Error("songDatabaseId, name, and artist are required");
  }
  const performer = await requirePerformer();
  await assertOwnsDatabase(performer.id, songDatabaseId);

  await prisma.song.create({ data: { songDatabaseId, name, artist, decade } });
  revalidatePath(`/dashboard/databases/${songDatabaseId}`);
}

// Adds one song to several databases at once — from the Song Databases
// list page, not any single database's own page — so a song that belongs
// on multiple set lists (e.g. a "Guitar" list and an "All Songs"
// superset) doesn't need re-entering once per database. Each database
// still gets its own separate Song row (same reasoning as everywhere else
// a song is duplicated per database: CSV replace, decade edits, etc. are
// all per-database), createMany just does all the inserts in one query.
export async function createSongInDatabases(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const artist = String(formData.get("artist") ?? "").trim();
  const decade = String(formData.get("decade") ?? "").trim() || null;
  const songDatabaseIds = formData.getAll("songDatabaseIds").map(String).filter(Boolean);

  if (!name || !artist) throw new Error("Song name and artist are required");
  if (songDatabaseIds.length === 0) throw new Error("Choose at least one database");
  const performer = await requirePerformer();
  await assertOwnsDatabases(performer.id, songDatabaseIds);

  await prisma.song.createMany({
    data: songDatabaseIds.map((songDatabaseId) => ({ songDatabaseId, name, artist, decade })),
  });

  revalidatePath("/dashboard/databases");
  for (const id of songDatabaseIds) revalidatePath(`/dashboard/databases/${id}`);
}

export async function updateSong(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const songDatabaseId = String(formData.get("songDatabaseId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const artist = String(formData.get("artist") ?? "").trim();
  const decade = String(formData.get("decade") ?? "").trim() || null;

  if (!id || !name || !artist) throw new Error("name and artist are required");
  const performer = await requirePerformer();

  await prisma.song.updateMany({
    where: { id, songDatabase: { performerId: performer.id } },
    data: { name, artist, decade },
  });
  revalidatePath(`/dashboard/databases/${songDatabaseId}`);
}

export async function deleteSong(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const songDatabaseId = String(formData.get("songDatabaseId") ?? "");
  if (!id) throw new Error("id is required");
  const performer = await requirePerformer();

  await prisma.song.deleteMany({ where: { id, songDatabase: { performerId: performer.id } } });
  revalidatePath(`/dashboard/databases/${songDatabaseId}`);
}

// Replace semantics (locked decision): the uploaded CSV becomes the new full
// song list for this database — anything not in the CSV is removed.
export async function importSongsCsv(formData: FormData) {
  const songDatabaseId = String(formData.get("songDatabaseId") ?? "");
  const file = formData.get("file") as File | null;
  if (!songDatabaseId || !file) throw new Error("songDatabaseId and file are required");
  const performer = await requirePerformer();
  await assertOwnsDatabase(performer.id, songDatabaseId);

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
