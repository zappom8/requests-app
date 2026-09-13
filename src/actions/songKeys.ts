"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// Saved per-field (one input's onBlur at a time) rather than the whole row
// at once, so filling in a table of songs saves as you go without a submit
// button per row. Global by song name+artist — see the SongKey model
// comment in schema.prisma for why.
export async function setSongKey(formData: FormData) {
  const songName = String(formData.get("songName") ?? "").trim();
  const artistName = String(formData.get("artistName") ?? "").trim();
  const field = String(formData.get("field") ?? "");
  const value = String(formData.get("value") ?? "").trim() || null;

  if (!songName || !artistName) throw new Error("songName and artistName are required");
  if (field !== "originalKey" && field !== "lochiesKey") throw new Error("field must be originalKey or lochiesKey");

  const existing = await prisma.songKey.findUnique({ where: { songName_artistName: { songName, artistName } } });
  const originalKey = field === "originalKey" ? value : (existing?.originalKey ?? null);
  const lochiesKey = field === "lochiesKey" ? value : (existing?.lochiesKey ?? null);

  // Both fields empty — nothing worth keeping a row for.
  if (!originalKey && !lochiesKey) {
    if (existing) await prisma.songKey.delete({ where: { id: existing.id } });
    revalidatePath("/dashboard/keys");
    return;
  }

  await prisma.songKey.upsert({
    where: { songName_artistName: { songName, artistName } },
    create: { songName, artistName, originalKey, lochiesKey },
    update: { originalKey, lochiesKey },
  });

  revalidatePath("/dashboard/keys");
}
