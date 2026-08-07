import { NextResponse } from "next/server";
import { getPublicQueue } from "@/lib/queue";
import { getActiveSongDatabaseId } from "@/lib/settings";

export async function GET() {
  const activeSongDatabaseId = await getActiveSongDatabaseId();
  if (!activeSongDatabaseId) {
    return NextResponse.json({ queue: [] });
  }
  const queue = await getPublicQueue(activeSongDatabaseId);
  return NextResponse.json({ queue });
}
