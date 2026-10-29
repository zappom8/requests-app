import { NextResponse } from "next/server";
import { getAdminQueue, getRecentlyPlayed } from "@/lib/queue";
import { getActiveSongDatabaseId } from "@/lib/settings";
import { syncCurrentVenue } from "@/lib/venueSchedule";
import { wakeLiveControl } from "@/lib/liveControlGate";
import { getBangerKeys } from "@/lib/bangers";
import { getSignedInPerformer } from "@/lib/auth";

// src/proxy.ts already rejects signed-out requests to /api/dashboard/*;
// this also rejects a login with no Performer, and scopes to the caller's.
export async function GET() {
  const performer = await getSignedInPerformer();
  if (!performer) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  // Follows the gigs calendar (±1h around each gig, Busking otherwise), so a
  // Live Queue left open across a gig start/end switches venue by itself.
  const [activeSongDatabaseId, currentVenueId] = await Promise.all([
    getActiveSongDatabaseId(performer.id),
    syncCurrentVenue(performer.id),
  ]);
  // An open Live Queue keeps the phone/laptop receivers awake (only writes when it extends by 5+ min).
  await wakeLiveControl(performer.id).catch(() => null);
  const bangerKeys = await getBangerKeys(currentVenueId);
  if (!activeSongDatabaseId) {
    return NextResponse.json({ queue: [], bangerKeys, currentVenueId, recentlyPlayed: [] });
  }
  const [queue, recentlyPlayed] = await Promise.all([
    getAdminQueue(activeSongDatabaseId),
    getRecentlyPlayed(activeSongDatabaseId),
  ]);
  return NextResponse.json({ queue, bangerKeys, currentVenueId, recentlyPlayed });
}
