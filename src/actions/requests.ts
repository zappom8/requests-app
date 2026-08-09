"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { broadcastQueueChanged } from "@/lib/supabase/server";
import { squareClient } from "@/lib/square";
import { SquareError } from "square";
import type { PaymentStatus } from "@/generated/prisma/client";

export type CreateRequestInput = {
  songDatabaseId: string;
  songId: string;
  songName: string;
  artistName: string;
  decade: string | null;
  requesterName: string;
  wantsShoutOut: boolean;
};

const MIN_TIP_CENTS = 50; // Square's practical minimum charge

async function insertUntippedRequest(input: CreateRequestInput, paymentStatus: PaymentStatus) {
  const requesterName = input.requesterName.trim();
  if (!requesterName) throw new Error("Your name is required");
  if (!input.songId || !input.songDatabaseId) throw new Error("A song must be selected");

  const request = await prisma.request.create({
    data: {
      songDatabaseId: input.songDatabaseId,
      songId: input.songId,
      songName: input.songName,
      artistName: input.artistName,
      decade: input.decade,
      requesterName,
      wantsShoutOut: input.wantsShoutOut,
      paymentStatus,
    },
  });

  revalidatePath("/queue");
  await broadcastQueueChanged(input.songDatabaseId);
  return request;
}

// Next.js redacts thrown Server Action errors to a generic digest in
// production builds (dev shows the real message, masking this until it hit
// Preview) — expected failures (validation, declines) must be returned, not
// thrown, or the client only ever sees "An error occurred in the Server
// Components render."
type ActionResult<T = object> = (T & { success: true }) | { success: false; error: string };

// No-tip path.
export async function createRequest(input: CreateRequestInput): Promise<ActionResult<{ id: string }>> {
  try {
    const request = await insertUntippedRequest(input, "NONE");
    return { success: true, id: request.id };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong. Please try again." };
  }
}

// Tip path: the request enters the queue immediately, in untipped position.
// Nothing is charged yet — the client tokenizes a payment method (card/Apple
// Pay/Google Pay) via Square's Web Payments SDK, then confirmTipPayment
// actually charges it. An abandoned or failed payment never blocks or
// removes the request.
export async function createRequestWithTip(
  input: CreateRequestInput & { tipAmountCents: number }
): Promise<ActionResult<{ id: string }>> {
  try {
    if (!Number.isInteger(input.tipAmountCents) || input.tipAmountCents < MIN_TIP_CENTS) {
      throw new Error("Tip amount must be at least $0.50");
    }
    const request = await insertUntippedRequest(input, "PENDING");
    return { success: true, id: request.id };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong. Please try again." };
  }
}

// Charges the tip via Square's CreatePayment API, which completes
// synchronously — unlike Stripe's PaymentIntent+webhook-confirms pattern,
// the DB write happens in the same request/response cycle as the charge
// itself, so this server action (not a webhook) is the primary source of
// truth for payment success/failure. A webhook (src/app/api/webhooks/square)
// still backfills the processing fee, which often isn't available yet on
// this synchronous response, and acts as a reconciliation safety net.
// TODO before going live with real money: add Square's verifyBuyer() (SCA/
// 3-D Secure) step on the client and pass its verificationToken here — some
// card issuers can decline without it. Skipped for now since it needs buyer
// billing-contact details we don't currently collect; fine for Sandbox
// testing, not fine for production.
export async function confirmTipPayment(
  requestId: string,
  sourceId: string,
  tipAmountCents: number
): Promise<ActionResult> {
  if (!Number.isInteger(tipAmountCents) || tipAmountCents < MIN_TIP_CENTS) {
    return { success: false, error: "Tip amount must be at least $0.50" };
  }

  const request = await prisma.request.findUnique({ where: { id: requestId } });
  if (!request) return { success: false, error: "Request not found" };
  if (request.paymentStatus === "SUCCEEDED") return { success: false, error: "This request has already been paid" };

  // First attempt uses the request's own id (stable, matches how
  // stripePaymentIntentId used to key off the request 1:1). A retry after a
  // FAILED attempt needs a fresh key, or Square would just replay the
  // earlier failed response instead of trying the new payment method.
  const idempotencyKey = request.paymentStatus === "FAILED" ? `${requestId}-retry-${Date.now()}` : requestId;

  try {
    const { payment } = await squareClient.payments.create({
      sourceId,
      idempotencyKey,
      amountMoney: { amount: BigInt(tipAmountCents), currency: "AUD" },
      locationId: process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID!,
    });

    if (!payment || (payment.status !== "COMPLETED" && payment.status !== "APPROVED")) {
      await prisma.request.update({ where: { id: requestId }, data: { paymentStatus: "FAILED" } });
      return { success: false, error: "Payment was not approved. Please try again." };
    }

    const squareFeeCents = payment.processingFee?.length
      ? payment.processingFee.reduce((sum, fee) => sum + Number(fee.amountMoney?.amount ?? 0), 0)
      : null;
    const billingName = payment.cardDetails?.card?.cardholderName ?? null;

    await prisma.request.update({
      where: { id: requestId },
      data: {
        tipAmountCents,
        paymentStatus: "SUCCEEDED",
        squarePaymentId: payment.id,
        squareFeeCents,
        billingName,
      },
    });

    revalidatePath("/queue");
    await broadcastQueueChanged(request.songDatabaseId);

    return { success: true };
  } catch (e) {
    await prisma.request.update({ where: { id: requestId }, data: { paymentStatus: "FAILED" } });
    // SquareError's own .message is the raw "Status code: 400 Body: {...}"
    // string — not something to show a payer. Its structured .errors array
    // has the actual human-readable detail (e.g. "Authorization error: ...").
    const message =
      e instanceof SquareError && e.errors[0]?.detail
        ? e.errors[0].detail
        : e instanceof Error
          ? e.message
          : "Payment failed. Please try again.";
    return { success: false, error: message };
  }
}
