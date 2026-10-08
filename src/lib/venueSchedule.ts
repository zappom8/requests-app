import "server-only";
import ical from "node-ical";
import { prisma } from "@/lib/prisma";
import { broadcastQueueChanged } from "@/lib/supabase/server";
import { getActiveSongDatabaseId } from "@/lib/settings";

// Works out which Venue Lochie is at from the gigs calendar: a calendar
// event whose title/location contains one of a venue's calendarKeywords is a
// gig at that venue, and counts from 1 hour before it starts to 1 hour after
// it ends. Outside every window the Busking venue is used.

const BUFFER_MS = 60 * 60 * 1000;
// Used when a calendar event has no end time.
const DEFAULT_GIG_MS = 3 * 60 * 60 * 1000;
// How far back to look for the most recent gig window when deciding whether
// a manual venue pick is still current.
const LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_MS = 5 * 60 * 1000;

export type VenueWindow = { venueId: string; start: Date; end: Date; title: string };
type VenueKeywords = { id: string; calendarKeywords: string[]; isBusking: boolean };

type RawEvent = { title: string; location: string; start: Date; end: Date };

// Parsed calendars are cached briefly so tagging a request or loading the
// Live Queue doesn't re-download the whole feed each time.
const calendarCache = new Map<string, { at: number; data: Awaited<ReturnType<typeof ical.async.fromURL>> }>();

async function loadCalendar(url: string) {
  const hit = calendarCache.get(url);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;
  const data = await ical.async.fromURL(url);
  calendarCache.set(url, { at: Date.now(), data });
  return data;
}

function text(value: unknown): string {
  if (!value) return "";
  return typeof value === "string" ? value : ((value as { val?: string }).val ?? "");
}

async function fetchEvents(icsUrls: string[], from: Date, to: Date): Promise<RawEvent[]> {
  const results = await Promise.allSettled(icsUrls.map(loadCalendar));
  if (icsUrls.length > 0 && results.every((r) => r.status === "rejected")) {
    throw new Error("Couldn't load the gigs calendar");
  }
  const events: RawEvent[] = [];
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const event of Object.values(result.value)) {
      if (!event || event.type !== "VEVENT" || !event.start) continue;
      // An all-day event has no start time to build a window from.
      if (event.rrule) {
        for (const i of ical.expandRecurringEvent(event, { from, to })) {
          if (i.isFullDay) continue;
          events.push({
            title: text(i.summary),
            location: text(i.event.location),
            start: i.start,
            end: i.end ?? new Date(i.start.getTime() + DEFAULT_GIG_MS),
          });
        }
        continue;
      }
      if (event.datetype === "date") continue;
      const start = event.start as Date;
      const end = (event.end as Date | undefined) ?? new Date(start.getTime() + DEFAULT_GIG_MS);
      if (end < from || start > to) continue;
      events.push({ title: text(event.summary), location: text(event.location), start, end });
    }
  }
  return events;
}

// The venue whose keyword appears in the event — the longest keyword wins
// when more than one venue matches.
function matchVenue(event: RawEvent, venues: VenueKeywords[]): string | null {
  const haystack = `${event.title} ${event.location}`.toLowerCase();
  let best: { id: string; length: number } | null = null;
  for (const v of venues) {
    if (v.isBusking) continue;
    for (const raw of v.calendarKeywords) {
      const keyword = raw.trim().toLowerCase();
      if (keyword && haystack.includes(keyword) && (!best || keyword.length > best.length)) {
        best = { id: v.id, length: keyword.length };
      }
    }
  }
  return best?.id ?? null;
}

export async function getVenueWindows(
  icsUrls: string[],
  venues: VenueKeywords[],
  from: Date,
  to: Date
): Promise<VenueWindow[]> {
  // Fetch a little wider so windows that only reach into the range via the
  // buffer are still found.
  const events = await fetchEvents(icsUrls, new Date(from.getTime() - BUFFER_MS), new Date(to.getTime() + BUFFER_MS));
  const windows: VenueWindow[] = [];
  for (const e of events) {
    const venueId = matchVenue(e, venues);
    if (!venueId) continue;
    windows.push({
      venueId,
      title: e.title,
      start: new Date(e.start.getTime() - BUFFER_MS),
      end: new Date(e.end.getTime() + BUFFER_MS),
    });
  }
  return windows.sort((a, b) => a.start.getTime() - b.start.getTime());
}

// The window covering `at`; if several overlap, the one that began last.
export function windowAt(windows: VenueWindow[], at: Date): VenueWindow | null {
  let found: VenueWindow | null = null;
  for (const w of windows) {
    if (w.start <= at && at <= w.end && (!found || w.start > found.start)) found = w;
  }
  return found;
}

export async function ensureBuskingVenue(performerId: string): Promise<string> {
  const existing = await prisma.venue.findFirst({ where: { performerId, isBusking: true }, select: { id: true } });
  if (existing) return existing.id;
  const created = await prisma.venue.create({ data: { performerId, name: "Busking", isBusking: true } });
  return created.id;
}

// What the current venue should be right now. A venue picked by hand holds
// until a new gig window has opened since the pick; otherwise the gig window
// containing `now`, otherwise Busking. Returns null if the calendar can't be
// read (callers keep whatever is already set).
export async function resolveVenueId(performerId: string, now = new Date()): Promise<string | null> {
  const [settings, venues] = await Promise.all([
    prisma.settings.findUnique({ where: { performerId } }),
    prisma.venue.findMany({
      where: { performerId },
      select: { id: true, calendarKeywords: true, isBusking: true },
    }),
  ]);

  let windows: VenueWindow[];
  try {
    windows = await getVenueWindows(
      (settings?.gigsCalendarUrls ?? []).map((u) => u.replace(/^webcal/i, "https")),
      venues,
      new Date(now.getTime() - LOOKBACK_MS),
      now
    );
  } catch (e) {
    console.error("[venueSchedule] calendar unavailable", e);
    return null;
  }

  const active = windowAt(windows, now);
  const lastStart = windows.filter((w) => w.start <= now).reduce<Date | null>(
    (latest, w) => (!latest || w.start > latest ? w.start : latest),
    null
  );
  const manualAt = settings?.currentVenueManualAt;
  const manualStillHolds =
    !!manualAt && !!settings?.currentVenueId && (!lastStart || manualAt >= lastStart);
  if (manualStillHolds) return settings!.currentVenueId;

  return active?.venueId ?? (await ensureBuskingVenue(performerId));
}

// Brings Settings.currentVenueId (what the Live Queue and Banger Mode read)
// in line with the calendar, tells open Live Queues, and returns the venue.
export async function syncCurrentVenue(performerId: string): Promise<string | null> {
  const resolved = await resolveVenueId(performerId);
  const settings = await prisma.settings.findUnique({ where: { performerId } });
  if (!resolved) return settings?.currentVenueId ?? null;
  if (resolved !== settings?.currentVenueId) {
    await prisma.settings.upsert({
      where: { performerId },
      update: { currentVenueId: resolved },
      create: { performerId, currentVenueId: resolved },
    });
    const activeSongDatabaseId = await getActiveSongDatabaseId(performerId);
    if (activeSongDatabaseId) await broadcastQueueChanged(activeSongDatabaseId);
  }
  return resolved;
}
