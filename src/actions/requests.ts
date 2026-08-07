"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { broadcastQueueChanged } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
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

const MIN_TIP_CENTS = 50; // Stripe's practical minimum charge

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

// No-tip path.
export async function createRequest(input: CreateRequestInput) {
  const request = await insertUntippedRequest(input, "NONE");
  return { id: request.id };
}

// Tip path: the request enters the queue immediately, in untipped position —
// a PaymentIntent is created and linked, but the tip amount (and the queue
// re-sort that comes with it) only takes effect once the Stripe webhook
// confirms payment (src/app/api/webhooks/stripe/route.ts). An abandoned or
// failed payment never blocks or removes the request.
export async function createRequestWithTip(input: CreateRequestInput & { tipAmountCents: number }) {
  if (!Number.isInteger(input.tipAmountCents) || input.tipAmountCents < MIN_TIP_CENTS) {
    throw new Error("Tip amount must be at least $0.50");
  }

  const request = await insertUntippedRequest(input, "PENDING");

  const paymentIntent = await stripe.paymentIntents.create({
    amount: input.tipAmountCents,
    currency: "aud",
    automatic_payment_methods: { enabled: true },
    metadata: { requestId: request.id },
  });

  await prisma.request.update({
    where: { id: request.id },
    data: { stripePaymentIntentId: paymentIntent.id },
  });

  return { id: request.id, clientSecret: paymentIntent.client_secret };
}

// Retry path: if creating/attaching the initial PaymentIntent failed
// client-side after the Request row already exists, attach a fresh
// PaymentIntent to the SAME row rather than creating a duplicate request.
export async function retryTipPayment(requestId: string, tipAmountCents: number) {
  if (!Number.isInteger(tipAmountCents) || tipAmountCents < MIN_TIP_CENTS) {
    throw new Error("Tip amount must be at least $0.50");
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: tipAmountCents,
    currency: "aud",
    automatic_payment_methods: { enabled: true },
    metadata: { requestId },
  });

  await prisma.request.update({
    where: { id: requestId },
    data: { stripePaymentIntentId: paymentIntent.id, paymentStatus: "PENDING" },
  });

  return { clientSecret: paymentIntent.client_secret };
}
