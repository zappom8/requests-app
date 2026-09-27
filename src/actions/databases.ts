"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { parseSongsCsv } from "@/lib/csv";
import { assertOwnsDatabase, requirePerformer } from "@/lib/auth";

// Next.js redacts thrown Server Action errors to a generic digest in
// production builds (dev shows the real message) — e.g. deleteSongDatabase
// used to throw on a foreign-key violation and every caller saw only
// "Minified React error #441" with the actual reason invisible. Every
// action below returns this instead of throwing on an expected failure.
type ActionResult<T = object> = (T & { success: true }) | { success: false; error: string };

export async function createSongDatabase(formData: FormData): Promise<ActionResult> {
  try {
    const name = String(formData.get("name") ?? "").trim();
    if (!name) throw new Error("Database name is required");
    const performer = await requirePerformer();

    const file = formData.get("file") as File | null;
    if (file && file.size > 0) {
      const songs = parseSongsCsv(await file.text());
      if (songs.length === 0) throw new Error("No valid rows found in that CSV.");
      await prisma.songDatabase.create({
        data: {
          performerId: performer.id,
          name,
          songs: { create: songs.map((s) => ({ name: s.name, artist: s.artist, decade: s.decade })) },
        },
      });
    } else {
      await prisma.songDatabase.create({ data: { performerId: performer.id, name } });
    }

    revalidatePath("/dashboard/databases");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong. Please try again." };
  }
}

export async function setActiveDatabase(formData: FormData): Promise<ActionResult> {
  try {
    const songDatabaseId = String(formData.get("songDatabaseId") ?? "");
    if (!songDatabaseId) throw new Error("songDatabaseId is required");
    const performer = await requirePerformer();
    await assertOwnsDatabase(performer.id, songDatabaseId);

    await prisma.settings.upsert({
      where: { performerId: performer.id },
      update: { activeSongDatabaseId: songDatabaseId },
      create: { performerId: performer.id, activeSongDatabaseId: songDatabaseId },
    });
    revalidatePath("/dashboard/databases");
    revalidatePath("/request");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong. Please try again." };
  }
}

export async function renameSongDatabase(formData: FormData): Promise<ActionResult> {
  try {
    const songDatabaseId = String(formData.get("songDatabaseId") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    if (!songDatabaseId || !name) throw new Error("songDatabaseId and name are required");
    const performer = await requirePerformer();

    await prisma.songDatabase.updateMany({ where: { id: songDatabaseId, performerId: performer.id }, data: { name } });
    revalidatePath("/dashboard/databases");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong. Please try again." };
  }
}

export async function duplicateSongDatabase(formData: FormData): Promise<ActionResult> {
  try {
    const songDatabaseId = String(formData.get("songDatabaseId") ?? "");
    if (!songDatabaseId) throw new Error("songDatabaseId is required");

    const performer = await requirePerformer();
    const source = await prisma.songDatabase.findFirst({
      where: { id: songDatabaseId, performerId: performer.id },
      include: { songs: true },
    });
    if (!source) throw new Error("Database not found");

    await prisma.songDatabase.create({
      data: {
        performerId: performer.id,
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
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong. Please try again." };
  }
}

// Deleting is only offered in the UI when the database is inactive and has
// no request history (Request.songDatabaseId is an FK with onDelete:
// RESTRICT specifically to protect permanent history — see plan). This
// action re-checks server-side regardless, since Server Actions are
// reachable directly and the UI check alone isn't a security boundary.
export async function deleteSongDatabase(formData: FormData): Promise<ActionResult> {
  try {
    const songDatabaseId = String(formData.get("songDatabaseId") ?? "");
    if (!songDatabaseId) throw new Error("songDatabaseId is required");
    const performer = await requirePerformer();
    await assertOwnsDatabase(performer.id, songDatabaseId);

    const [settings, requestCount] = await Promise.all([
      prisma.settings.findUnique({ where: { performerId: performer.id } }),
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
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong. Please try again." };
  }
}
