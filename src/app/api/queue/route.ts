import { NextResponse } from "next/server";
import { getPublicQueue } from "@/lib/queue";
import { getActiveSongDatabaseId } from "@/lib/settings";
import { getDefaultPerformer } from "@/lib/auth";

export async function GET() {
  const performer = await getDefaultPerformer();
  const activeSongDatabaseId = await getActiveSongDatabaseId(performer.id);
  if (!activeSongDatabaseId) {
    return NextResponse.json({ queue: [] });
  }
  const queue = await getPublicQueue(activeSongDatabaseId);
  return NextResponse.json({ queue });
}
