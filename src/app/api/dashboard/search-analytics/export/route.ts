import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { resolveDateRange } from "@/lib/statistics";
import { getSearchLogsForExport } from "@/lib/search-analytics";
import { getSignedInPerformer } from "@/lib/auth";
import { getVenueFilter } from "@/lib/venueFilter";

// Signed-out requests are rejected by src/proxy.ts; scoped to the caller's performer below. Carries
// forward the same dateFrom/dateTo/days filters as the Search Analytics
// page, so "download the CSV" exports exactly what's currently on screen —
// every logged search in range (not the top-20 ranked view), each with its
// own timestamp.
export async function GET(request: NextRequest) {
  const performer = await getSignedInPerformer();
  if (!performer) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const sp = request.nextUrl.searchParams;
  const days = sp.getAll("days");
  const range = resolveDateRange(sp.get("dateFrom") ?? undefined, sp.get("dateTo") ?? undefined, days);

  const { venueId } = await getVenueFilter(performer.id, sp.get("venueId") ?? undefined);
  const rows = await getSearchLogsForExport({ ...range, performerId: performer.id, venueId });

  const csv = Papa.unparse({
    fields: ["Search Term", "Results Found", "Event Type", "Searched At"],
    data: rows.map((r) => [
      r.searchTerm,
      r.resultsFound ? "Yes" : "No",
      r.eventType,
      r.createdAt.toLocaleString("en-AU", { timeZone: "Australia/Brisbane" }),
    ]),
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="search-history.csv"`,
    },
  });
}
