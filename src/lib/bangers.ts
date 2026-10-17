import { prisma } from "@/lib/prisma";
import { bangerKey } from "@/lib/bangerKey";
import { getCancelledArtists, isCancelledArtist } from "@/lib/cancelledArtists";

export async function getBangerKeys(venueId: string | null): Promise<string[]> {
  if (!venueId) return [];
  const bangers = await prisma.bangerSong.findMany({
    where: { venueId },
    select: { songName: true, artistName: true, venue: { select: { performerId: true } } },
  });
  if (bangers.length === 0) return [];
  // Songs by a cancelled artist aren't offered as bangers.
  const cancelled = await getCancelledArtists(bangers[0].venue.performerId);
  return bangers.filter((b) => !isCancelledArtist(b.artistName, cancelled)).map((b) => bangerKey(b.songName, b.artistName));
}
