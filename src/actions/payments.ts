"use server";

import { prisma } from "@/lib/prisma";
import { squareClient } from "@/lib/square";
import { SquareError } from "square";
import { revalidatePath } from "next/cache";

type ActionResult = { success: true } | { success: false; error: string };

// Refunds are financial-only (locked decision) — this deliberately never
// touches `status`, queue position, or broadcasts a queue-changed event.
// A refunded tip stays exactly where it already sorted to.
//
// Returns a result object rather than throwing for expected failures —
// Next.js redacts thrown Server Action errors to a generic digest in
// production builds, so a plain throw here would only ever show the caller
// "An error occurred in the Server Components render."
export async function refundTip(formData: FormData): Promise<ActionResult> {
  const requestId = String(formData.get("requestId") ?? "");
  if (!requestId) return { success: false, error: "requestId is required" };

  const request = await prisma.request.findUnique({ where: { id: requestId } });
  if (!request) return { success: false, error: "Request not found" };
  if (request.paymentStatus !== "SUCCEEDED") {
    return { success: false, error: `Can't refund a payment with status ${request.paymentStatus}` };
  }

  if (request.stripePaymentIntentId && !request.squarePaymentId) {
    // Historical Stripe-era payment — the app no longer holds Stripe
    // credentials post-migration to Square.
    return { success: false, error: "This is a legacy Stripe payment. Refund it directly from the Stripe Dashboard." };
  }
  if (!request.squarePaymentId) return { success: false, error: "This request has no payment to refund" };

  try {
    await squareClient.refunds.refundPayment({
      paymentId: request.squarePaymentId,
      idempotencyKey: `refund-${requestId}`,
      amountMoney: { amount: BigInt(request.tipAmountCents), currency: "AUD" },
    });
  } catch (e) {
    const message =
      e instanceof SquareError && e.errors[0]?.detail
        ? e.errors[0].detail
        : e instanceof Error
          ? e.message
          : "Refund failed. Please try again.";
    return { success: false, error: message };
  }

  await prisma.request.update({
    where: { id: requestId },
    data: { paymentStatus: "REFUNDED", refundedAmountCents: request.tipAmountCents },
  });

  revalidatePath("/dashboard/payments");
  return { success: true };
}
