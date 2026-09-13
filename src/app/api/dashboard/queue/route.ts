import { NextResponse } from "next/server";
import { getAdminQueue } from "@/lib/queue";
import { getActiveSongDatabaseId, getCurrentVenueId } from "@/lib/settings";
import { getBangerKeys } from "@/lib/bangers";

// Auth is enforced by src/proxy.ts (matches /api/dashboard/:path*) — by the
// time a request reaches here, it's already been verified as authenticated.
export async function GET() {
  const [activeSongDatabaseId, currentVenueId] = await Promise.all([getActiveSongDatabaseId(), getCurrentVenueId()]);
  const bangerKeys = await getBangerKeys(currentVenueId);
  if (!activeSongDatabaseId) {
    return NextResponse.json({ queue: [], bangerKeys, currentVenueId });
  }
  const queue = await getAdminQueue(activeSongDatabaseId);
  return NextResponse.json({ queue, bangerKeys, currentVenueId });
}
