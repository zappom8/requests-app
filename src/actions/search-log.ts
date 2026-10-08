"use server";

import { prisma } from "@/lib/prisma";
import { resolveVenueId } from "@/lib/venueSchedule";

export type SearchLogEventType = "debounce" | "submit" | "select";

// Logged on submit / result-select / debounce-after-typing-stop only — never
// per keystroke (locked decision). Our search UI has no explicit "submit"
// button (it's live-as-you-type), so in practice this fires on "debounce"
// (query settled ~1s with no further typing) or "select" (user picked a
// result before the debounce timer fired).
export async function logSearch(input: {
  songDatabaseId: string;
  searchTerm: string;
  resultsFound: boolean;
  eventType: SearchLogEventType;
}) {
  const searchTerm = input.searchTerm.trim();
  if (!searchTerm) return;

  const db = await prisma.songDatabase.findUnique({
    where: { id: input.songDatabaseId },
    select: { performerId: true },
  });
  const venueId = db ? await resolveVenueId(db.performerId).catch(() => null) : null;

  await prisma.searchLog.create({
    data: {
      venueId,
      songDatabaseId: input.songDatabaseId,
      searchTerm,
      resultsFound: input.resultsFound,
      eventType: input.eventType,
    },
  });
}
