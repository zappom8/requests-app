import { prisma } from "@/lib/prisma";
import { bangerKey } from "@/lib/bangerKey";

export async function getBangerKeys(venueId: string | null): Promise<string[]> {
  if (!venueId) return [];
  const bangers = await prisma.bangerSong.findMany({ where: { venueId }, select: { songName: true, artistName: true } });
  return bangers.map((b) => bangerKey(b.songName, b.artistName));
}
