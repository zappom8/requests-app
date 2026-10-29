import "server-only";
import { prisma } from "@/lib/prisma";
import { isInGigWindow } from "@/lib/venueSchedule";

// The receivers (the phone's Shortcut, the laptop's Hammerspoon) hold a long-poll connection open to
// /api/live-control/next. Holding connections around the clock used up Vercel's free memory allowance,
// so they're only answered "for real" while the system is awake:
//   - the Live Queue page is open (opening it, e.g. from Gig Mode, wakes them for WAKE_HOURS, and its
//     once-a-minute refresh keeps extending that, so a gig of any length stays awake), or
//   - a calendar gig window (1h before to 1h after) is open.
// Otherwise the route replies straight away with 503 (the laptop helper retries every 5s, cheaply).
export const WAKE_HOURS = 2;

// Called when the Live Queue page loads. Only rewrites when it would extend the wake-up by 5+ minutes.
export async function wakeLiveControl(performerId: string) {
  const until = new Date(Date.now() + WAKE_HOURS * 60 * 60 * 1000);
  const settings = await prisma.settings.findUnique({ where: { performerId }, select: { liveControlActiveUntil: true } });
  const current = settings?.liveControlActiveUntil;
  if (current && until.getTime() - current.getTime() < 5 * 60 * 1000) return;
  await prisma.settings.upsert({
    where: { performerId },
    update: { liveControlActiveUntil: until },
    create: { performerId, liveControlActiveUntil: until },
  });
}

// In-memory for a few seconds so a burst of sleeping polls doesn't each hit the database.
const cache = new Map<string, { at: number; active: boolean }>();
const CACHE_MS = 10_000;

export async function isLiveControlActive(performerId: string): Promise<boolean> {
  const hit = cache.get(performerId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.active;
  const settings = await prisma.settings.findUnique({ where: { performerId }, select: { liveControlActiveUntil: true } });
  let active = !!settings?.liveControlActiveUntil && settings.liveControlActiveUntil.getTime() > Date.now();
  if (!active) active = await isInGigWindow(performerId);
  cache.set(performerId, { at: Date.now(), active });
  return active;
}
