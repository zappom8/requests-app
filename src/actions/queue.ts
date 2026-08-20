"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { broadcastQueueChanged } from "@/lib/supabase/server";

// Both actions are soft — they change status and drop out of the active
// queue view, but the row is never deleted. Full permanent history. Take an
// array of request ids because the Live Queue merges every still-queued
// request for the same song into one entry — resolving it resolves the
// whole group at once, since the song only actually gets played once.
export async function markPlayed(requestIds: string[], songDatabaseId: string) {
  await prisma.request.updateMany({
    where: { id: { in: requestIds } },
    data: { status: "PLAYED", playedAt: new Date() },
  });

  revalidatePath("/queue");
  await broadcastQueueChanged(songDatabaseId);
}

export async function deleteRequest(requestIds: string[], songDatabaseId: string) {
  await prisma.request.updateMany({
    where: { id: { in: requestIds } },
    data: { status: "DELETED", deletedAt: new Date() },
  });

  revalidatePath("/queue");
  await broadcastQueueChanged(songDatabaseId);
}
