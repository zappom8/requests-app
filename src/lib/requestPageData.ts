import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCancelledArtists, notCancelledSongFilter } from "@/lib/cancelledArtists";

export const REQUEST_PAGE_TAG = "request-page";

// The song list rebuild is the expensive part of loading /request (~1s of CPU),
// and it's identical for everyone — so build it once and share it for a minute.
// Settings changes that affect it (cancelled artists, tip amounts, active
// database) call revalidateTag(REQUEST_PAGE_TAG) so they show up immediately.
// Recently-played is NOT in here: it must stay live, see page.tsx.
export const getCachedRequestPageData = unstable_cache(
  async (performerId: string) => {
    const settings = await prisma.settings.findUnique({
      where: { performerId },
      select: {
        activeSongDatabaseId: true,
        defaultTipAmountsCents: true,
        disableRecentlyPlayedPrompt: true,
        tipThankYouTiers: true,
      },
    });
    const activeSongDatabaseId = settings?.activeSongDatabaseId ?? null;
    if (!activeSongDatabaseId) return { activeSongDatabaseId: null, settings, songs: [], artists: [], decades: [] };

    const cancelledArtists = await getCancelledArtists(performerId);
    const songs = await prisma.song.findMany({
      where: { songDatabaseId: activeSongDatabaseId, ...notCancelledSongFilter(cancelledArtists) },
      orderBy: { name: "asc" },
      select: { id: true, name: true, artist: true, decade: true },
    });
    const artists = Array.from(new Set(songs.map((s) => s.artist))).sort();
    const decades = Array.from(new Set(songs.map((s) => s.decade).filter((d): d is string => !!d))).sort();
    return { activeSongDatabaseId, settings, songs, artists, decades };
  },
  ["request-page-data"],
  { revalidate: 60, tags: [REQUEST_PAGE_TAG] },
);
