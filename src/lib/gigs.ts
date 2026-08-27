import "server-only";
import ical from "node-ical";

export type Gig = {
  uid: string;
  title: string;
  start: Date;
  end: Date | null;
  location: string | null;
  isFullDay: boolean;
};

export type GigsResult = {
  gigs: Gig[];
  // True only when every calendar failed to load — a partial failure (e.g.
  // one of two calendars down) still shows whatever did load, silently.
  allFailed: boolean;
};

// Only show what's coming up soon — no point listing a gig 6 months out
// (and it keeps a stale/forgotten far-future calendar entry from lingering).
const LOOKAHEAD_MONTHS = 2;

function paramValue(value: { val: string } | string | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.val;
}

// A shared calendar isn't necessarily gig-only (could be someone's whole
// personal calendar) — VEVENTs are all we render, everything else (VTODO,
// VTIMEZONE, VCALENDAR metadata) is ignored.
function extractGigs(data: Awaited<ReturnType<typeof ical.async.fromURL>>, now: Date, horizon: Date): Gig[] {
  const gigs: Gig[] = [];

  for (const event of Object.values(data)) {
    if (!event || event.type !== "VEVENT" || !event.start) continue;

    if (event.rrule) {
      const instances = ical.expandRecurringEvent(event, { from: now, to: horizon });
      for (const instance of instances) {
        gigs.push({
          uid: `${event.uid}-${instance.start.toISOString()}`,
          title: paramValue(instance.summary) ?? "Untitled event",
          start: instance.start,
          end: instance.end ?? null,
          location: paramValue(instance.event.location),
          isFullDay: instance.isFullDay,
        });
      }
      continue;
    }

    const start = event.start as Date;
    if (start < now || start > horizon) continue;
    gigs.push({
      uid: event.uid,
      title: paramValue(event.summary) ?? "Untitled event",
      start,
      end: (event.end as Date | undefined) ?? null,
      location: paramValue(event.location),
      isFullDay: event.datetype === "date",
    });
  }

  return gigs;
}

// Multiple calendars (e.g. a general gigs calendar plus a separate weekly
// residency one) get merged into a single sorted list. One calendar being
// down doesn't hide the others — allFailed only trips when none loaded.
export async function getUpcomingGigs(icsUrls: string[]): Promise<GigsResult> {
  const now = new Date();
  const horizon = new Date(now);
  horizon.setMonth(horizon.getMonth() + LOOKAHEAD_MONTHS);

  const results = await Promise.allSettled(icsUrls.map((url) => ical.async.fromURL(url)));

  const gigs: Gig[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      gigs.push(...extractGigs(result.value, now, horizon));
    }
  }

  gigs.sort((a, b) => a.start.getTime() - b.start.getTime());
  const allFailed = icsUrls.length > 0 && results.every((r) => r.status === "rejected");
  return { gigs, allFailed };
}
