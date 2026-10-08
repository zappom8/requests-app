import { NextRequest, NextResponse } from "next/server";
import { getPayments } from "@/lib/payments";
import Papa from "papaparse";
import { getSignedInPerformer } from "@/lib/auth";
import { getVenueFilter } from "@/lib/venueFilter";

// Signed-out requests are rejected by src/proxy.ts; scoped to the caller's performer below.
export async function GET(request: NextRequest) {
  const performer = await getSignedInPerformer();
  if (!performer) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const dateFrom = request.nextUrl.searchParams.get("dateFrom") ?? undefined;
  const dateTo = request.nextUrl.searchParams.get("dateTo") ?? undefined;

  const requestedVenue = request.nextUrl.searchParams.get("venueId") ?? undefined;
  const { venueId } = await getVenueFilter(performer.id, requestedVenue);
  const { items } = await getPayments({ dateFrom, dateTo, venueId }, performer.id);

  const csv = Papa.unparse({
    fields: ["Requester", "Venue", "Song", "Artist", "Gross", "Fee", "Net", "Refunded", "Status", "Provider", "Payment ID", "Date"],
    data: items.map((item) => [
      item.requesterName,
      item.venueName ?? "",
      item.songName,
      item.artistName,
      (item.tipAmountCents / 100).toFixed(2),
      ((item.effectiveFeeCents ?? 0) / 100).toFixed(2),
      ((item.tipAmountCents - (item.effectiveFeeCents ?? 0) - item.refundedAmountCents) / 100).toFixed(2),
      (item.refundedAmountCents / 100).toFixed(2),
      item.paymentStatus,
      item.provider ?? "",
      item.effectivePaymentId ?? "",
      item.requestedAt.toISOString(),
    ]),
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tips-and-payments.csv"`,
    },
  });
}
