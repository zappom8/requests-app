import { NextRequest, NextResponse } from "next/server";
import { buildGigIcs } from "@/lib/gigs";

// Stateless by design — gigs live in an external calendar, not the DB, so
// this just re-packages whatever the client already has (from /gigs) into a
// single-event .ics rather than needing to re-fetch and match by id.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const title = params.get("title");
  const startRaw = params.get("start");
  const endRaw = params.get("end");
  const location = params.get("location");
  const url = params.get("url");

  if (!title || !startRaw) {
    return NextResponse.json({ error: "title and start are required" }, { status: 400 });
  }

  const start = new Date(startRaw);
  if (Number.isNaN(start.getTime())) {
    return NextResponse.json({ error: "invalid start" }, { status: 400 });
  }
  const end = endRaw ? new Date(endRaw) : null;
  if (end && Number.isNaN(end.getTime())) {
    return NextResponse.json({ error: "invalid end" }, { status: 400 });
  }

  const ics = buildGigIcs({ title, start, end, location, url });

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      // No "attachment" disposition — iOS Safari's native Add-to-Calendar
      // sheet only appears for an inline text/calendar response; forcing a
      // download instead sends it to Files.
      "Content-Disposition": `inline; filename="${encodeURIComponent(title)}.ics"`,
    },
  });
}
