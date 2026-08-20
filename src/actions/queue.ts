"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { broadcastQueueChanged } from "@/lib/supabase/server";

// Both actions are soft — they change status and drop out of the active
// queue view, but the row is never deleted. Full permanent history. Take an
// array of request ids because the Live Queue merges every still-queued
// request for the same song into one entry — resolving it resolves the
// whole group at once, since the song only actually gets played once.
//
// Both are scoped to status: "QUEUED" so they're safe no-ops on a row
// that's already been resolved another way — e.g. a UI race where a stale
// refetch briefly shows an already-PLAYED item as still queued again, and a
// DJ hits DELETE on what they (correctly!) believe is stuck in the queue.
// Without this guard that would silently overwrite the row's real PLAYED
// status/playedAt with DELETED, losing the accurate play record.
export async function markPlayed(requestIds: string[], songDatabaseId: string) {
  await prisma.request.updateMany({
    where: { id: { in: requestIds }, status: "QUEUED" },
    data: { status: "PLAYED", playedAt: new Date() },
  });

  revalidatePath("/queue");
  await broadcastQueueChanged(songDatabaseId);
}

export async function deleteRequest(requestIds: string[], songDatabaseId: string) {
  await prisma.request.updateMany({
    where: { id: { in: requestIds }, status: "QUEUED" },
    data: { status: "DELETED", deletedAt: new Date() },
  });

  revalidatePath("/queue");
  await broadcastQueueChanged(songDatabaseId);
}
