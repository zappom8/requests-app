"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requirePerformer } from "@/lib/auth";

const FIELDS = ["title", "filename", "setlist"] as const;
type Field = (typeof FIELDS)[number];

// Saved per field on blur, same as setSongKey. Per performer, global by
// song name+artist — see the ForScoreLink model comment in schema.prisma.
export async function setForScoreLink(formData: FormData) {
  const songName = String(formData.get("songName") ?? "").trim();
  const artistName = String(formData.get("artistName") ?? "").trim();
  const field = String(formData.get("field") ?? "") as Field;
  const value = String(formData.get("value") ?? "").trim() || null;

  if (!songName || !artistName) throw new Error("songName and artistName are required");
  if (!FIELDS.includes(field)) throw new Error("field must be title, filename or setlist");
  const performer = await requirePerformer();
  const where = { performerId_songName_artistName: { performerId: performer.id, songName, artistName } };

  const existing = await prisma.forScoreLink.findUnique({ where });
  const next = {
    title: existing?.title ?? null,
    filename: existing?.filename ?? null,
    setlist: existing?.setlist ?? null,
    [field]: value,
  };

  if (!next.title && !next.filename && !next.setlist) {
    if (existing) await prisma.forScoreLink.delete({ where: { id: existing.id } });
  } else {
    await prisma.forScoreLink.upsert({
      where,
      create: { performerId: performer.id, songName, artistName, ...next },
      update: next,
    });
  }

  revalidatePath("/dashboard/forscore");
  revalidatePath("/dashboard/queue");
}
