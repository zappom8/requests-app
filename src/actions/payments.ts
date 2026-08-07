"use server";

import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { revalidatePath } from "next/cache";

// Refunds are financial-only (locked decision) — this deliberately never
// touches `status`, queue position, or broadcasts a queue-changed event.
// A refunded tip stays exactly where it already sorted to.
export async function refundTip(formData: FormData) {
  const requestId = String(formData.get("requestId") ?? "");
  if (!requestId) throw new Error("requestId is required");

  const request = await prisma.request.findUnique({ where: { id: requestId } });
  if (!request) throw new Error("Request not found");
  if (!request.stripePaymentIntentId) throw new Error("This request has no payment to refund");
  if (request.paymentStatus !== "SUCCEEDED") {
    throw new Error(`Can't refund a payment with status ${request.paymentStatus}`);
  }

  await stripe.refunds.create({ payment_intent: request.stripePaymentIntentId });

  await prisma.request.update({
    where: { id: requestId },
    data: { paymentStatus: "REFUNDED", refundedAmountCents: request.tipAmountCents },
  });

  revalidatePath("/dashboard/payments");
}
