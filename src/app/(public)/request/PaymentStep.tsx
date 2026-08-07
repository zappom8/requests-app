"use client";

import { useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { stripePromise } from "@/lib/stripe-client";

function PaymentForm({ amountCents, onSuccess }: { amountCents: number; onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePay() {
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/queue` },
      redirect: "if_required",
    });

    if (confirmError) {
      setError(confirmError.message ?? "Payment failed. Please try again.");
      setSubmitting(false);
      return;
    }

    // No redirect needed (card/Apple Pay/Google Pay all resolve inline) —
    // the webhook confirms the payment server-side; this just advances the UI.
    onSuccess();
  }

  return (
    <div className="flex flex-col gap-4">
      <PaymentElement
        onLoadError={(e) => {
          console.error("PaymentElement loadError detail:", JSON.stringify(e));
          setError(e.error.message ?? "Couldn't load payment form.");
        }}
      />
      {error && <p className="text-sm text-danger">{error}</p>}
      <button
        onClick={handlePay}
        disabled={submitting || !stripe || !elements}
        className="rounded-lg bg-accent px-4 py-3 text-base font-medium text-accent-foreground hover:bg-accent-hover disabled:opacity-50"
      >
        {submitting ? "Processing…" : `Pay $${(amountCents / 100).toFixed(2)}`}
      </button>
    </div>
  );
}

export default function PaymentStep({
  clientSecret,
  amountCents,
  onSuccess,
  onBack,
}: {
  clientSecret: string;
  amountCents: number;
  onSuccess: () => void;
  onBack: () => void;
}) {
  return (
    <div className="min-h-screen px-4 py-6 max-w-md mx-auto flex flex-col gap-6">
      <button onClick={onBack} className="text-sm text-foreground-muted text-left hover:text-foreground">
        ← Back
      </button>
      <div>
        <h2 className="text-xl font-semibold">Complete your tip</h2>
        <p className="text-sm text-foreground-muted">Your request is already in the queue — this just moves it up.</p>
      </div>
      <Elements
        stripe={stripePromise}
        options={{ clientSecret, appearance: { theme: "night" } }}
      >
        <PaymentForm amountCents={amountCents} onSuccess={onSuccess} />
      </Elements>
    </div>
  );
}
