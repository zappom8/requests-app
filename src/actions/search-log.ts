"use server";

import { prisma } from "@/lib/prisma";

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

  await prisma.searchLog.create({
    data: {
      songDatabaseId: input.songDatabaseId,
      searchTerm,
      resultsFound: input.resultsFound,
      eventType: input.eventType,
    },
  });
}
