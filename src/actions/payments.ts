"use server";

import { prisma } from "@/lib/prisma";
import { squareClient } from "@/lib/square";
import { revalidatePath } from "next/cache";

// Refunds are financial-only (locked decision) — this deliberately never
// touches `status`, queue position, or broadcasts a queue-changed event.
// A refunded tip stays exactly where it already sorted to.
export async function refundTip(formData: FormData) {
  const requestId = String(formData.get("requestId") ?? "");
  if (!requestId) throw new Error("requestId is required");

  const request = await prisma.request.findUnique({ where: { id: requestId } });
  if (!request) throw new Error("Request not found");
  if (request.paymentStatus !== "SUCCEEDED") {
    throw new Error(`Can't refund a payment with status ${request.paymentStatus}`);
  }

  if (request.stripePaymentIntentId && !request.squarePaymentId) {
    // Historical Stripe-era payment — the app no longer holds Stripe
    // credentials post-migration to Square.
    throw new Error("This is a legacy Stripe payment. Refund it directly from the Stripe Dashboard.");
  }
  if (!request.squarePaymentId) throw new Error("This request has no payment to refund");

  await squareClient.refunds.refundPayment({
    paymentId: request.squarePaymentId,
    idempotencyKey: `refund-${requestId}`,
    amountMoney: { amount: BigInt(request.tipAmountCents), currency: "AUD" },
  });

  await prisma.request.update({
    where: { id: requestId },
    data: { paymentStatus: "REFUNDED", refundedAmountCents: request.tipAmountCents },
  });

  revalidatePath("/dashboard/payments");
}
