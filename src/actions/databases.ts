"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createSongDatabase(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Database name is required");

  await prisma.songDatabase.create({ data: { name } });
  revalidatePath("/dashboard/databases");
}

export async function setActiveDatabase(formData: FormData) {
  const songDatabaseId = String(formData.get("songDatabaseId") ?? "");
  if (!songDatabaseId) throw new Error("songDatabaseId is required");

  await prisma.settings.upsert({
    where: { id: 1 },
    update: { activeSongDatabaseId: songDatabaseId },
    create: { id: 1, activeSongDatabaseId: songDatabaseId },
  });
  revalidatePath("/dashboard/databases");
  revalidatePath("/request");
}

export async function renameSongDatabase(formData: FormData) {
  const songDatabaseId = String(formData.get("songDatabaseId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!songDatabaseId || !name) throw new Error("songDatabaseId and name are required");

  await prisma.songDatabase.update({ where: { id: songDatabaseId }, data: { name } });
  revalidatePath("/dashboard/databases");
}

export async function duplicateSongDatabase(formData: FormData) {
  const songDatabaseId = String(formData.get("songDatabaseId") ?? "");
  if (!songDatabaseId) throw new Error("songDatabaseId is required");

  const source = await prisma.songDatabase.findUnique({
    where: { id: songDatabaseId },
    include: { songs: true },
  });
  if (!source) throw new Error("Database not found");

  await prisma.songDatabase.create({
    data: {
      name: `${source.name} (copy)`,
      songs: {
        create: source.songs.map((song) => ({
          name: song.name,
          artist: song.artist,
          decade: song.decade,
        })),
      },
    },
  });
  revalidatePath("/dashboard/databases");
}

// Deleting is only offered in the UI when the database is inactive and has
// no request history (Request.songDatabaseId is an FK with onDelete:
// RESTRICT specifically to protect permanent history — see plan). This
// action re-checks server-side regardless, since Server Actions are
// reachable directly and the UI check alone isn't a security boundary.
export async function deleteSongDatabase(formData: FormData) {
  const songDatabaseId = String(formData.get("songDatabaseId") ?? "");
  if (!songDatabaseId) throw new Error("songDatabaseId is required");

  const [settings, requestCount] = await Promise.all([
    prisma.settings.findUnique({ where: { id: 1 } }),
    prisma.request.count({ where: { songDatabaseId } }),
  ]);

  if (settings?.activeSongDatabaseId === songDatabaseId) {
    throw new Error("Can't delete the active database — set a different one active first.");
  }
  if (requestCount > 0) {
    throw new Error("Can't delete — this database has request history.");
  }

  await prisma.songDatabase.delete({ where: { id: songDatabaseId } });
  revalidatePath("/dashboard/databases");
}
