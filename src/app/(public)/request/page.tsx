import { prisma } from "@/lib/prisma";
import { getDefaultPerformer } from "@/lib/auth";
import RequestFlow from "./RequestFlow";
import { getCachedRequestPageData } from "@/lib/requestPageData";
import { parseTipThanksTiers } from "@/lib/tipThanks";

// Must always reflect the current active database and its current songs —
// never statically cached.
export const dynamic = "force-dynamic";

export default async function RequestPage() {
  const performer = await getDefaultPerformer();
  // Song list + settings come from a 60s shared cache (see requestPageData.ts).
  const { activeSongDatabaseId, settings, songs, artists, decades } = await getCachedRequestPageData(performer.id);

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
  // Kept live (not cached) so "just played" stays accurate.
  const recentlyPlayedRequests = await prisma.request.findMany({
    // isPairedAddition/isBangerAddition excluded — an auto-added song was
    // never a real request, so it shouldn't trigger the "this was just
    // played" prompt any more than it counts toward Statistics.
    where: {
      songDatabaseId: activeSongDatabaseId,
      status: "PLAYED",
      playedAt: { gte: oneHourAgo },
      songId: { not: null },
      isPairedAddition: false,
      isBangerAddition: false,
    },
    select: { songId: true, playedAt: true },
    orderBy: { playedAt: "desc" },
  });

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
      tipThankYouTiers={parseTipThanksTiers(settings?.tipThankYouTiers)}
    />
  );
}
