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

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const [songs, settings, recentlyPlayedRequests] = await Promise.all([
    prisma.song.findMany({
      where: { songDatabaseId: activeSongDatabaseId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, artist: true, decade: true },
    }),
    prisma.settings.findUnique({
      where: { id: 1 },
      select: { defaultTipAmountsCents: true, disableRecentlyPlayedPrompt: true },
    }),
    prisma.request.findMany({
      where: { songDatabaseId: activeSongDatabaseId, status: "PLAYED", playedAt: { gte: oneHourAgo }, songId: { not: null } },
      select: { songId: true, playedAt: true },
      orderBy: { playedAt: "desc" },
    }),
  ]);

  const artists = Array.from(new Set(songs.map((s) => s.artist))).sort();
  const decades = Array.from(new Set(songs.map((s) => s.decade).filter((d): d is string => !!d))).sort();

  // Keep only the most recent play per song — requests are ordered newest
  // first above, so the first entry seen per songId wins.
  const recentlyPlayed: Record<string, string> = {};
  for (const r of recentlyPlayedRequests) {
    if (r.songId && !(r.songId in recentlyPlayed)) {
      recentlyPlayed[r.songId] = r.playedAt!.toISOString();
    }
  }

  return (
    <RequestFlow
      songDatabaseId={activeSongDatabaseId}
      initialSongs={songs}
      artists={artists}
      decades={decades}
      tipPresetsCents={settings?.defaultTipAmountsCents ?? [500, 1000, 2000]}
      recentlyPlayed={recentlyPlayed}
      recentlyPlayedPromptEnabled={!settings?.disableRecentlyPlayedPrompt}
    />
  );
}
