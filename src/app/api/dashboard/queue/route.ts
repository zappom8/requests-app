import { NextResponse } from "next/server";
import { getAdminQueue } from "@/lib/queue";
import { getActiveSongDatabaseId } from "@/lib/settings";

// Auth is enforced by src/proxy.ts (matches /api/dashboard/:path*) — by the
// time a request reaches here, it's already been verified as authenticated.
export async function GET() {
  const activeSongDatabaseId = await getActiveSongDatabaseId();
  if (!activeSongDatabaseId) {
    return NextResponse.json({ queue: [] });
  }
  const queue = await getAdminQueue(activeSongDatabaseId);
  return NextResponse.json({ queue });
}
