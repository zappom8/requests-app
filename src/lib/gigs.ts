import "server-only";
import ical from "node-ical";

export type Gig = {
  uid: string;
  title: string;
  start: Date;
  end: Date | null;
  location: string | null;
  // The event's "URL" field in Calendar — lets Lochie point a gig at the
  // venue's actual website/Google listing instead of a generic Maps search.
  url: string | null;
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

// event.url comes through the same {val, params} wrapper as summary/location
// despite its .d.ts type claiming a plain string — and node-ical still
// returns that wrapper (with an empty .val) for events with no URL set at
// all, rather than undefined. Unwrap it and treat a blank result as absent,
// or React ends up rendering the whole object into an href.
function eventUrl(value: unknown): string | null {
  const raw = paramValue(value as { val: string } | string | undefined);
  const trimmed = raw?.trim();
  return trimmed ? trimmed : null;
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
          url: eventUrl(instance.event.url),
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
      url: eventUrl(event.url),
      isFullDay: event.datetype === "date",
    });
  }

  return gigs;
}

function icsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

// RFC 5545 §3.3.11 text escaping — backslash, semicolon, comma, and newline
// are structural characters in an ICS value and must be escaped literally.
function escapeIcsText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

// Falls back to a 2-hour slot when a calendar event has no end time — long
// enough to cover a typical DJ set, short enough not to look like an all-day
// block on the viewer's own calendar.
const DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000;

// Builds a standalone single-event .ics so a viewer can add a gig straight
// to their own calendar — not the feed /gigs itself reads from.
export function buildGigIcs(gig: { title: string; start: Date; end: Date | null; location: string | null; url: string | null }): string {
  const end = gig.end ?? new Date(gig.start.getTime() + DEFAULT_DURATION_MS);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Lochie Gig//Gigs//EN",
    "BEGIN:VEVENT",
    `UID:${gig.start.getTime()}-${encodeURIComponent(gig.title)}@lochiegig`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(gig.start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${escapeIcsText(gig.title)}`,
    gig.location ? `LOCATION:${escapeIcsText(gig.location)}` : null,
    gig.url ? `URL:${gig.url}` : null,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter((line): line is string => line !== null);

  return lines.join("\r\n");
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
