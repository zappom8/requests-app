import { prisma } from "@/lib/prisma";
import { getActiveSongDatabaseId } from "@/lib/settings";
import RequestFlow from "./RequestFlow";

// Must always reflect the current active database and its current songs —
// never statically cached.
export const dynamic = "force-dynamic";

export default async function RequestPage() {
  const activeSongDatabaseId = await getActiveSongDatabaseId();

  if (!activeSongDatabaseId) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 text-center">
        <p className="text-foreground-muted">
          No song database is active right now. Check back soon.
        </p>
      </div>
    );
  }

  const [songs, settings] = await Promise.all([
    prisma.song.findMany({
      where: { songDatabaseId: activeSongDatabaseId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, artist: true, decade: true },
    }),
    prisma.settings.findUnique({ where: { id: 1 }, select: { defaultTipAmountsCents: true } }),
  ]);

  const artists = Array.from(new Set(songs.map((s) => s.artist))).sort();
  const decades = Array.from(new Set(songs.map((s) => s.decade).filter((d): d is string => !!d))).sort();

  return (
    <RequestFlow
      songDatabaseId={activeSongDatabaseId}
      initialSongs={songs}
      artists={artists}
      decades={decades}
      tipPresetsCents={settings?.defaultTipAmountsCents ?? [500, 1000, 2000]}
    />
  );
}
