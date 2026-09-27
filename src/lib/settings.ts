import { prisma } from "@/lib/prisma";

// One Settings row per performer (created on first save).
export function getSettings(performerId: string) {
  return prisma.settings.findUnique({ where: { performerId } });
}

export async function getActiveSongDatabaseId(performerId: string): Promise<string | null> {
  const settings = await getSettings(performerId);
  return settings?.activeSongDatabaseId ?? null;
}

export async function getCurrentVenueId(performerId: string): Promise<string | null> {
  const settings = await getSettings(performerId);
  return settings?.currentVenueId ?? null;
}
