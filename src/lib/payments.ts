import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

export type PaymentFilters = {
  dateFrom?: string;
  dateTo?: string;
};

export type PaymentProvider = "stripe" | "square" | null;

export type PaymentItem = {
  id: string;
  songName: string;
  artistName: string;
  requesterName: string;
  tipAmountCents: number;
  stripeFeeCents: number | null;
  squareFeeCents: number | null;
  refundedAmountCents: number;
  paymentStatus: string;
  stripePaymentIntentId: string | null;
  squarePaymentId: string | null;
  provider: PaymentProvider;
  effectivePaymentId: string | null;
  effectiveFeeCents: number | null;
  requestedAt: Date;
};

export type PaymentTotals = {
  grossCents: number;
  feeCents: number;
  refundedCents: number;
  netCents: number;
  count: number;
};

function buildWhere(filters: PaymentFilters): Prisma.RequestWhereInput {
  const where: Prisma.RequestWhereInput = {
    paymentStatus: { in: ["SUCCEEDED", "REFUNDED", "PARTIALLY_REFUNDED"] },
  };
  if (filters.dateFrom || filters.dateTo) {
    where.requestedAt = {
      ...(filters.dateFrom ? { gte: new Date(`${filters.dateFrom}T00:00:00`) } : {}),
      ...(filters.dateTo ? { lte: new Date(`${filters.dateTo}T23:59:59.999`) } : {}),
    };
  }
  return where;
}

export async function getPayments(filters: PaymentFilters): Promise<{ items: PaymentItem[]; totals: PaymentTotals }> {
  const where = buildWhere(filters);

  const rows = await prisma.request.findMany({
    where,
    orderBy: { requestedAt: "desc" },
    select: {
      id: true,
      songName: true,
      artistName: true,
      requesterName: true,
      tipAmountCents: true,
      stripeFeeCents: true,
      squareFeeCents: true,
      refundedAmountCents: true,
      paymentStatus: true,
      stripePaymentIntentId: true,
      squarePaymentId: true,
      requestedAt: true,
    },
  });

  // Rows mix historical Stripe payments and current Square ones (never
  // both) — coalesce here once, so the dashboard/CSV just consume the
  // derived fields instead of duplicating this logic.
  const items: PaymentItem[] = rows.map((row) => {
    const provider: PaymentProvider = row.squarePaymentId ? "square" : row.stripePaymentIntentId ? "stripe" : null;
    return {
      ...row,
      provider,
      effectivePaymentId: row.squarePaymentId ?? row.stripePaymentIntentId ?? null,
      effectiveFeeCents: row.squareFeeCents ?? row.stripeFeeCents ?? null,
    };
  });

  const totals = items.reduce<PaymentTotals>(
    (acc, item) => {
      acc.grossCents += item.tipAmountCents;
      acc.feeCents += item.effectiveFeeCents ?? 0;
      acc.refundedCents += item.refundedAmountCents;
      acc.count += 1;
      return acc;
    },
    { grossCents: 0, feeCents: 0, refundedCents: 0, netCents: 0, count: 0 }
  );
  totals.netCents = totals.grossCents - totals.feeCents - totals.refundedCents;

  return { items, totals };
}
