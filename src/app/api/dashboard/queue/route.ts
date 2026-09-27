import { NextResponse } from "next/server";
import { getAdminQueue } from "@/lib/queue";
import { getActiveSongDatabaseId, getCurrentVenueId } from "@/lib/settings";
import { getBangerKeys } from "@/lib/bangers";
import { getSignedInPerformer } from "@/lib/auth";

// src/proxy.ts already rejects signed-out requests to /api/dashboard/*;
// this also rejects a login with no Performer, and scopes to the caller's.
export async function GET() {
  const performer = await getSignedInPerformer();
  if (!performer) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const [activeSongDatabaseId, currentVenueId] = await Promise.all([
    getActiveSongDatabaseId(performer.id),
    getCurrentVenueId(performer.id),
  ]);
  const bangerKeys = await getBangerKeys(currentVenueId);
  if (!activeSongDatabaseId) {
    return NextResponse.json({ queue: [], bangerKeys, currentVenueId });
  }
  const queue = await getAdminQueue(activeSongDatabaseId);
  return NextResponse.json({ queue, bangerKeys, currentVenueId });
}
