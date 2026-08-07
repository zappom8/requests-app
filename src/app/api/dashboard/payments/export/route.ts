import { NextRequest, NextResponse } from "next/server";
import { getPayments } from "@/lib/payments";
import Papa from "papaparse";

// Auth enforced by src/proxy.ts (matches /api/dashboard/:path*).
export async function GET(request: NextRequest) {
  const dateFrom = request.nextUrl.searchParams.get("dateFrom") ?? undefined;
  const dateTo = request.nextUrl.searchParams.get("dateTo") ?? undefined;

  const { items } = await getPayments({ dateFrom, dateTo });

  const csv = Papa.unparse({
    fields: ["Requester", "Song", "Artist", "Gross", "Fee", "Net", "Refunded", "Status", "Provider", "Payment ID", "Date"],
    data: items.map((item) => [
      item.requesterName,
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
