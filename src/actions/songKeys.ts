"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requirePerformer } from "@/lib/auth";

const FIELDS = ["originalKey", "lochiesKey", "startChord", "endChord", "capo"] as const;
const INSTRUMENTS = ["guitar", "piano"] as const;
type Field = (typeof FIELDS)[number];

// Saved per-field (one input's onBlur at a time) rather than the whole row
// at once, so filling in a table of songs saves as you go without a submit
// button per row. Per performer, global by song name+artist — see the SongKey model
// comment in schema.prisma for why.
export async function setSongKey(formData: FormData) {
  const songName = String(formData.get("songName") ?? "").trim();
  const artistName = String(formData.get("artistName") ?? "").trim();
  const field = String(formData.get("field") ?? "") as Field;
  const instrument = String(formData.get("instrument") ?? "guitar");
  const value = String(formData.get("value") ?? "").trim() || null;

  if (!songName || !artistName) throw new Error("songName and artistName are required");
  if (!FIELDS.includes(field)) throw new Error(`field must be one of ${FIELDS.join(", ")}`);
  if (!(INSTRUMENTS as readonly string[]).includes(instrument)) throw new Error("instrument must be guitar or piano");
  if (field === "capo" && instrument !== "guitar") throw new Error("capo is guitar only");
  const performer = await requirePerformer();
  const where = { performerId_instrument_songName_artistName: { performerId: performer.id, instrument, songName, artistName } };

  const existing = await prisma.songKey.findUnique({ where });
  const next = {
    originalKey: existing?.originalKey ?? null,
    lochiesKey: existing?.lochiesKey ?? null,
    startChord: existing?.startChord ?? null,
    endChord: existing?.endChord ?? null,
    capo: existing?.capo ?? null,
    [field]: value,
  };

  // Every field empty — nothing worth keeping a row for.
  if (!next.originalKey && !next.lochiesKey && !next.startChord && !next.endChord && !next.capo) {
    if (existing) await prisma.songKey.delete({ where: { id: existing.id } });
    revalidatePath("/dashboard/keys");
    return;
  }

  await prisma.songKey.upsert({
    where,
    create: { performerId: performer.id, instrument, songName, artistName, ...next },
    update: next,
  });

  revalidatePath("/dashboard/keys");
}
