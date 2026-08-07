import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

export type SongResult = {
  id: string;
  name: string;
  artist: string;
  decade: string | null;
};

// Fuzzy + substring search over the active database's songs, combining plain
// ILIKE substring matches with pg_trgm similarity so short queries still
// match (trigram similarity alone is unreliable on very short strings) while
// typos still surface results. Search analytics logging hooks in here later
// (Phase 7) — not wired up yet, out of Phase 1 scope.
export async function searchSongs(
  songDatabaseId: string,
  query: string,
  limit = 30
): Promise<SongResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  return prisma.$queryRaw<SongResult[]>(Prisma.sql`
    SELECT id, name, artist, decade,
      GREATEST(similarity(name, ${trimmed}), similarity(artist, ${trimmed})) AS score
    FROM "Song"
    WHERE "songDatabaseId" = ${songDatabaseId}
      AND (
        name ILIKE ${"%" + trimmed + "%"}
        OR artist ILIKE ${"%" + trimmed + "%"}
        OR name % ${trimmed}
        OR artist % ${trimmed}
      )
    ORDER BY score DESC, name ASC
    LIMIT ${limit}
  `);
}
