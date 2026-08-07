import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { broadcastQueueChanged } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Webhook is the sole source of truth for payment/tip state — the client
// confirming payment only advances the UI, it never writes DB state itself.
export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Missing signature or webhook secret" }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: `Webhook signature verification failed: ${message}` }, { status: 400 });
  }

  if (event.type === "payment_intent.succeeded") {
    await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
  } else if (event.type === "payment_intent.payment_failed") {
    await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
  } else if (event.type === "charge.updated") {
    await handleChargeUpdated(event.data.object as Stripe.Charge);
  }

  return NextResponse.json({ received: true });
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const request = await prisma.request.findUnique({
    where: { stripePaymentIntentId: paymentIntent.id },
  });
  if (!request) return; // unrelated PaymentIntent, or already handled — safe to ignore

  let stripeFeeCents: number | null = null;
  const chargeId =
    typeof paymentIntent.latest_charge === "string" ? paymentIntent.latest_charge : paymentIntent.latest_charge?.id;
  if (chargeId) {
    try {
      const charge = await stripe.charges.retrieve(chargeId, { expand: ["balance_transaction"] });
      const balanceTransaction = charge.balance_transaction;
      if (balanceTransaction && typeof balanceTransaction !== "string") {
        stripeFeeCents = balanceTransaction.fee;
      }
    } catch {
      // Fee not available yet — stripeFeeCents stays null, backfillable later (Phase 6).
    }
  }

  await prisma.request.update({
    where: { id: request.id },
    data: {
      tipAmountCents: paymentIntent.amount_received,
      paymentStatus: "SUCCEEDED",
      stripeFeeCents,
    },
  });

  revalidatePath("/queue");
  await broadcastQueueChanged(request.songDatabaseId);
}

// The fee isn't reliably present yet when payment_intent.succeeded fires —
// Stripe sends a later charge.updated event once balance_transaction (and
// its fee) is actually available. Backfill from that instead of polling.
async function handleChargeUpdated(charge: Stripe.Charge) {
  const paymentIntentId =
    typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!paymentIntentId) return;

  const request = await prisma.request.findUnique({ where: { stripePaymentIntentId: paymentIntentId } });
  if (!request || request.stripeFeeCents !== null) return; // already backfilled, or unrelated charge

  const balanceTransactionId =
    typeof charge.balance_transaction === "string" ? charge.balance_transaction : charge.balance_transaction?.id;
  if (!balanceTransactionId) return;

  const balanceTransaction = await stripe.balanceTransactions.retrieve(balanceTransactionId);
  await prisma.request.update({
    where: { id: request.id },
    data: { stripeFeeCents: balanceTransaction.fee },
  });
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  const request = await prisma.request.findUnique({
    where: { stripePaymentIntentId: paymentIntent.id },
  });
  if (!request) return;

  // Request stays QUEUED, untipped — never removed or blocked for lack of payment.
  await prisma.request.update({
    where: { id: request.id },
    data: { paymentStatus: "FAILED" },
  });
}
