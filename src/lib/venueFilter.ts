import { prisma } from "@/lib/prisma";

// Venues for the stats pages' filter dropdown, plus the requested venue id
// only if it really is one of this performer's (anything else = all venues).
export async function getVenueFilter(performerId: string, requested?: string) {
  const venues = await prisma.venue.findMany({
    where: { performerId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const venueId = requested && venues.some((v) => v.id === requested) ? requested : undefined;
  return { venues, venueId };
}
