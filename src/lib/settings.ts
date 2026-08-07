import { prisma } from "@/lib/prisma";

export async function getActiveSongDatabaseId(): Promise<string | null> {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  return settings?.activeSongDatabaseId ?? null;
}
