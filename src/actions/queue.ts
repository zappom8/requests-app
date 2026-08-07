"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { broadcastQueueChanged } from "@/lib/supabase/server";

// Both actions are soft — they change status and drop out of the active
// queue view, but the row is never deleted. Full permanent history.
export async function markPlayed(requestId: string) {
  const request = await prisma.request.update({
    where: { id: requestId },
    data: { status: "PLAYED", playedAt: new Date() },
  });

  revalidatePath("/queue");
  await broadcastQueueChanged(request.songDatabaseId);
}

export async function deleteRequest(requestId: string) {
  const request = await prisma.request.update({
    where: { id: requestId },
    data: { status: "DELETED", deletedAt: new Date() },
  });

  revalidatePath("/queue");
  await broadcastQueueChanged(request.songDatabaseId);
}
