// One-off: tag existing Requests and SearchLogs with the venue Lochie was at,
// using the gigs calendar's past events (each gig counts from 1h before to 1h
// after), and Busking for everything outside a gig.
//
//   npx tsx --conditions react-server prisma/backfill-venues.ts          # dry run (counts only)
//   npx tsx --conditions react-server prisma/backfill-venues.ts --apply  # write the tags
//
// Uses whichever database DATABASE_URL points at. Only rows with no venue yet
// are touched, so it is safe to re-run.
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { ensureBuskingVenue, getVenueWindows, windowAt } from "@/lib/venueSchedule";

const apply = process.argv.includes("--apply");

async function main() {
  const performers = await prisma.performer.findMany({ select: { id: true } });
  for (const { id: performerId } of performers) {
    const settings = await prisma.settings.findUnique({ where: { performerId } });
    const venues = await prisma.venue.findMany({
      where: { performerId },
      select: { id: true, name: true, calendarKeywords: true, isBusking: true },
    });
    const owned = { songDatabase: { performerId }, venueId: null };
    const [reqRange, logRange] = await Promise.all([
      prisma.request.aggregate({ where: owned, _min: { requestedAt: true }, _max: { requestedAt: true } }),
      prisma.searchLog.aggregate({ where: owned, _min: { createdAt: true }, _max: { createdAt: true } }),
    ]);
    const starts = [reqRange._min.requestedAt, logRange._min.createdAt].filter((d): d is Date => !!d);
    const ends = [reqRange._max.requestedAt, logRange._max.createdAt].filter((d): d is Date => !!d);
    if (starts.length === 0) {
      console.log(`performer ${performerId}: nothing untagged`);
      continue;
    }
    const from = new Date(Math.min(...starts.map(Number)));
    const to = new Date(Math.max(...ends.map(Number)));

    const urls = (settings?.gigsCalendarUrls ?? []).map((u) => u.replace(/^webcal/i, "https"));
    const windows = await getVenueWindows(urls, venues, from, to);
    const buskingId = apply ? await ensureBuskingVenue(performerId) : (venues.find((v) => v.isBusking)?.id ?? "BUSKING");
    const nameOf = new Map(venues.map((v) => [v.id, v.name]));
    nameOf.set(buskingId, "Busking");
    console.log(`performer ${performerId}: ${windows.length} gig windows between ${from.toISOString()} and ${to.toISOString()}`);

    const tally = new Map<string, number>();
    const requests = await prisma.request.findMany({ where: owned, select: { id: true, requestedAt: true } });
    for (const r of requests) {
      const venueId = windowAt(windows, r.requestedAt)?.venueId ?? buskingId;
      tally.set(venueId, (tally.get(venueId) ?? 0) + 1);
      if (apply) await prisma.request.update({ where: { id: r.id }, data: { venueId } });
    }
    const logs = await prisma.searchLog.findMany({ where: owned, select: { id: true, createdAt: true } });
    for (const l of logs) {
      const venueId = windowAt(windows, l.createdAt)?.venueId ?? buskingId;
      if (apply) await prisma.searchLog.update({ where: { id: l.id }, data: { venueId } });
    }
    console.log(`  ${requests.length} requests, ${logs.length} search logs ${apply ? "tagged" : "would be tagged"}:`);
    for (const [vid, n] of [...tally].sort((a, b) => b[1] - a[1])) console.log(`    ${nameOf.get(vid) ?? vid}: ${n} requests`);
  }
}

main().finally(() => prisma.$disconnect());
