import { NextRequest, NextResponse } from "next/server";
import { WebhooksHelper } from "square";
import type { PaymentUpdatedEvent, RefundUpdatedEvent } from "square";
import { prisma } from "@/lib/prisma";
import { broadcastQueueChanged } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Payments are confirmed synchronously in src/actions/requests.ts
// (confirmTipPayment) — this webhook is a reconciliation safety net, not the
// primary confirmation path. It backfills the processing fee (frequently not
// available on the synchronous CreatePayment response, same edge case
// already solved once for Stripe's charge.updated) and reconciles refunds.
export async function POST(request: NextRequest) {
  const signatureHeader = request.headers.get("x-square-hmacsha256-signature");
  const signatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  const notificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/square`;

  if (!signatureHeader || !signatureKey) {
    return NextResponse.json({ error: "Missing signature or webhook secret" }, { status: 400 });
  }

  const rawBody = await request.text();

  const isValid = await WebhooksHelper.verifySignature({
    requestBody: rawBody,
    signatureHeader,
    signatureKey,
    notificationUrl,
  });
  if (!isValid) {
    return NextResponse.json({ error: "Webhook signature verification failed" }, { status: 400 });
  }

  const event = JSON.parse(rawBody);

  if (event.type === "payment.updated") {
    await handlePaymentUpdated(event as PaymentUpdatedEvent);
  } else if (event.type === "refund.updated") {
    await handleRefundUpdated(event as RefundUpdatedEvent);
  }

  return NextResponse.json({ received: true });
}

async function handlePaymentUpdated(event: PaymentUpdatedEvent) {
  const payment = event.data?.object?.payment;
  if (!payment?.id) return;

  const request = await prisma.request.findUnique({ where: { squarePaymentId: payment.id } });
  if (!request) return; // unrelated payment, or not yet linked — safe to ignore

  const squareFeeCents = payment.processingFee?.length
    ? payment.processingFee.reduce((sum, fee) => sum + Number(fee.amountMoney?.amount ?? 0), 0)
    : null;

  if (squareFeeCents !== null && request.squareFeeCents === null) {
    await prisma.request.update({ where: { id: request.id }, data: { squareFeeCents } });
  }

  // Reconciliation: the synchronous confirmTipPayment write is the primary
  // path, but if it ever failed to land (e.g. a crash between Square
  // approving and our DB write), this webhook still gets us to SUCCEEDED.
  if (payment.status === "COMPLETED" && request.paymentStatus !== "SUCCEEDED") {
    await prisma.request.update({
      where: { id: request.id },
      data: { paymentStatus: "SUCCEEDED", tipAmountCents: Number(payment.amountMoney?.amount ?? request.tipAmountCents) },
    });
    revalidatePath("/queue");
    await broadcastQueueChanged(request.songDatabaseId);
  }
}

async function handleRefundUpdated(event: RefundUpdatedEvent) {
  const refund = event.data?.object?.refund;
  if (!refund?.paymentId || refund.status !== "COMPLETED") return;

  const request = await prisma.request.findUnique({ where: { squarePaymentId: refund.paymentId } });
  if (!request || request.paymentStatus === "REFUNDED") return; // already reconciled

  await prisma.request.update({
    where: { id: request.id },
    data: { paymentStatus: "REFUNDED", refundedAmountCents: request.tipAmountCents },
  });
}
