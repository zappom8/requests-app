import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { resolveDateRange } from "@/lib/statistics";
import { getSearchLogsForExport } from "@/lib/search-analytics";

// Auth enforced by src/proxy.ts (matches /api/dashboard/:path*). Carries
// forward the same dateFrom/dateTo/days filters as the Search Analytics
// page, so "download the CSV" exports exactly what's currently on screen —
// every logged search in range (not the top-20 ranked view), each with its
// own timestamp.
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const days = sp.getAll("days");
  const range = resolveDateRange(sp.get("dateFrom") ?? undefined, sp.get("dateTo") ?? undefined, days);

  const rows = await getSearchLogsForExport(range);

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
