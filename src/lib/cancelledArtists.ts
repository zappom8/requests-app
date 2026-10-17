import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

// "Cancelled artists": hidden from the public request page/search and from the
// banger features, but their songs stay in the database. An artist is cancelled
// when its name contains a listed name (case-insensitive), so "Ed Sheeran" also
// covers "Ed Sheeran & Taylor Swift".
export async function getCancelledArtists(performerId: string): Promise<string[]> {
  const settings = await prisma.settings.findUnique({ where: { performerId }, select: { cancelledArtists: true } });
  return settings?.cancelledArtists ?? [];
}

export function isCancelledArtist(artist: string, cancelled: string[]): boolean {
  const a = artist.toLowerCase();
  return cancelled.some((c) => c.trim() && a.includes(c.trim().toLowerCase()));
}

// For Prisma `where` on Song: songs by none of the cancelled artists.
export function notCancelledSongFilter(cancelled: string[]): Prisma.SongWhereInput {
  return {
    AND: cancelled
      .filter((c) => c.trim())
      .map((c) => ({ NOT: { artist: { contains: c.trim(), mode: "insensitive" as const } } })),
  };
}

// For raw SQL over "Song": AND-able fragment.
export function notCancelledSql(cancelled: string[]): Prisma.Sql {
  const parts = cancelled.filter((c) => c.trim()).map((c) => Prisma.sql`artist NOT ILIKE ${"%" + c.trim() + "%"}`);
  return parts.length ? Prisma.sql`AND ${Prisma.join(parts, " AND ")}` : Prisma.sql``;
}
