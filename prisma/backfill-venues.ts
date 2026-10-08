// One-off: tag existing Requests and SearchLogs with the venue Lochie was at,
// using the gigs calendar's past events (each gig counts from 1h before to 1h
// after). Anything outside a gig window stays untagged (it still counts under
// "All venues"), unless a Brisbane date is assigned by hand for gigs that
// aren't on the calendar:
//
//   npx tsx --conditions react-server prisma/backfill-venues.ts          # dry run (counts only)
//   npx tsx --conditions react-server prisma/backfill-venues.ts --apply  # write the tags
//   ... --assign "2026-08-20=Porto" --assign "2026-08-22=Suzie Wong's"   # hand-assigned dates
//
// Uses whichever database DATABASE_URL points at. Only rows with no venue yet
// are touched, so it is safe to re-run.
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { getVenueWindows, windowAt } from "@/lib/venueSchedule";

const apply = process.argv.includes("--apply");
const assigns = new Map<string, string>();
process.argv.forEach((a, i) => {
  if (a === "--assign") {
    const [date, ...name] = process.argv[i + 1].split("=");
    assigns.set(date, name.join("="));
  }
});
const brisbaneDate = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Australia/Brisbane" });

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
    const nameOf = new Map(venues.map((v) => [v.id, v.name]));
    const idByName = new Map(venues.map((v) => [v.name, v.id]));
    for (const name of assigns.values()) if (!idByName.has(name)) throw new Error(`No venue named ${name}`);
    console.log(`performer ${performerId}: ${windows.length} gig windows between ${from.toISOString()} and ${to.toISOString()}`);

    const pick = (at: Date) => {
      const byWindow = windowAt(windows, at)?.venueId;
      if (byWindow) return byWindow;
      const name = assigns.get(brisbaneDate(at));
      return name ? idByName.get(name)! : null;
    };

    const tally = new Map<string, number>();
    const reqIds = new Map<string, string[]>();
    const logIds = new Map<string, string[]>();
    let untaggedReq = 0;
    const requests = await prisma.request.findMany({ where: owned, select: { id: true, requestedAt: true } });
    for (const r of requests) {
      const venueId = pick(r.requestedAt);
      if (!venueId) { untaggedReq++; continue; }
      tally.set(venueId, (tally.get(venueId) ?? 0) + 1);
      reqIds.set(venueId, [...(reqIds.get(venueId) ?? []), r.id]);
    }
    const logs = await prisma.searchLog.findMany({ where: owned, select: { id: true, createdAt: true } });
    for (const l of logs) {
      const venueId = pick(l.createdAt);
      if (venueId) logIds.set(venueId, [...(logIds.get(venueId) ?? []), l.id]);
    }
    if (apply) {
      for (const [venueId, ids] of reqIds) await prisma.request.updateMany({ where: { id: { in: ids } }, data: { venueId } });
      for (const [venueId, ids] of logIds) await prisma.searchLog.updateMany({ where: { id: { in: ids } }, data: { venueId } });
    }
    console.log(`  ${apply ? "tagged" : "would tag"} ${[...reqIds.values()].flat().length} of ${requests.length} requests; ${untaggedReq} left without a venue:`);
    for (const [vid, n] of [...tally].sort((a, b) => b[1] - a[1])) console.log(`    ${nameOf.get(vid) ?? vid}: ${n} requests`);
  }
}

main().finally(() => prisma.$disconnect());
