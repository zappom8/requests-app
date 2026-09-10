"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// Global — not scoped to a songDatabaseId, since the same physical song is
// a separate Song row in every database that includes it. See the
// SongPairing model comment in schema.prisma for why.
export async function createSongPairing(formData: FormData) {
  const fromSongName = String(formData.get("fromSongName") ?? "").trim();
  const fromArtistName = String(formData.get("fromArtistName") ?? "").trim();
  const toSongName = String(formData.get("toSongName") ?? "").trim();
  const toArtistName = String(formData.get("toArtistName") ?? "").trim();

  if (!fromSongName || !fromArtistName || !toSongName || !toArtistName) {
    throw new Error("Both songs are required");
  }
  if (fromSongName === toSongName && fromArtistName === toArtistName) {
    throw new Error("A song can't pair into itself");
  }

  await prisma.songPairing.upsert({
    where: {
      fromSongName_fromArtistName_toSongName_toArtistName: {
        fromSongName,
        fromArtistName,
        toSongName,
        toArtistName,
      },
    },
    create: { fromSongName, fromArtistName, toSongName, toArtistName },
    update: {},
  });

  revalidatePath("/dashboard/pairings");
}

export async function deleteSongPairing(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("id is required");

  await prisma.songPairing.delete({ where: { id } });
  revalidatePath("/dashboard/pairings");
}
