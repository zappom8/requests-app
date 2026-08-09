"use client";

import { useEffect, useRef, useState } from "react";
import { confirmTipPayment } from "@/actions/requests";
import { loadSquareSdk, type SquarePaymentMethod, type SquareVerificationDetails } from "@/lib/square-web-sdk";

export default function PaymentStep({
  requestId,
  requesterName,
  amountCents,
  onSuccess,
  onBack,
}: {
  requestId: string;
  requesterName: string;
  amountCents: number;
  onSuccess: () => void;
  onBack: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [cardReady, setCardReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applePayAvailable, setApplePayAvailable] = useState(false);
  const [googlePayAvailable, setGooglePayAvailable] = useState(false);

  const cardRef = useRef<SquarePaymentMethod | null>(null);
  const applePayRef = useRef<SquarePaymentMethod | null>(null);
  const googlePayRef = useRef<SquarePaymentMethod | null>(null);

  useEffect(() => {
    // Dev-mode React Strict Mode double-invokes this effect (mount, cleanup,
    // mount again) to catch missing-cleanup bugs. Track instances THIS
    // invocation created in local closure variables (not the shared refs,
    // which the second invocation would overwrite) so each invocation's
    // cleanup destroys exactly what it made — otherwise the two invocations
    // race to attach() the same DOM container and the card field never
    // reliably renders.
    let cancelled = false;
    let localCard: SquarePaymentMethod | null = null;
    let localApplePay: SquarePaymentMethod | null = null;
    let localGooglePay: SquarePaymentMethod | null = null;

    async function setup() {
      try {
        const Square = await loadSquareSdk();
        if (!Square) throw new Error("Square SDK unavailable");

        const payments = Square.payments(
          process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID!,
          process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID!
        );

        const card = await payments.card();
        if (cancelled) {
          await card.destroy();
          return;
        }
        localCard = card;
        await card.attach("#square-card-container");
        if (cancelled) return;
        cardRef.current = card;
        setCardReady(true);

        const paymentRequest = payments.paymentRequest({
          countryCode: "AU",
          currencyCode: "AUD",
          total: { amount: (amountCents / 100).toFixed(2), label: "Tip" },
        });

        try {
          const applePay = await payments.applePay(paymentRequest);
          if (cancelled) {
            await applePay.destroy();
          } else {
            localApplePay = applePay;
            await applePay.attach("#apple-pay-button");
            if (!cancelled) {
              applePayRef.current = applePay;
              setApplePayAvailable(true);
            }
          }
        } catch {
          // Apple Pay unavailable (non-Safari, no card in Wallet, etc.) — hide it, card still works.
        }

        try {
          const googlePay = await payments.googlePay(paymentRequest);
          if (cancelled) {
            await googlePay.destroy();
          } else {
            localGooglePay = googlePay;
            await googlePay.attach("#google-pay-button");
            if (!cancelled) {
              googlePayRef.current = googlePay;
              setGooglePayAvailable(true);
            }
          }
        } catch {
          // Google Pay unavailable — hide it, card still works.
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't load payment form.");
      }
    }

    setup();

    return () => {
      cancelled = true;
      localCard?.destroy();
      localApplePay?.destroy();
      localGooglePay?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handlePay(method: SquarePaymentMethod | null) {
    if (!method) return;
    setSubmitting(true);
    setError(null);

    // Square requires buyer-verification details (SCA) directly in tokenize()
    // now — verifyBuyer() as a separate call is deprecated. AU-only business,
    // so countryCode is hardcoded; name is all we collect on this form.
    const verificationDetails: SquareVerificationDetails = {
      amount: (amountCents / 100).toFixed(2),
      currencyCode: "AUD",
      intent: "CHARGE",
      customerInitiated: true,
      sellerKeyedIn: false,
      billingContact: { givenName: requesterName, countryCode: "AU" },
    };

    try {
      console.log("[payment debug] tokenizing with", verificationDetails);
      const result = await method.tokenize(verificationDetails);
      console.log("[payment debug] tokenize result", result);
      if (result.status !== "OK" || !result.token) {
        throw new Error(result.errors?.[0]?.message ?? "Payment method wasn't accepted. Please try again.");
      }
      console.log("[payment debug] confirming payment", { requestId, amountCents });
      await confirmTipPayment(requestId, result.token, amountCents);
      onSuccess();
    } catch (e) {
      console.error("[payment debug] handlePay error", e);
      setError(e instanceof Error ? e.message : "Payment failed. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen w-full px-4 py-6 max-w-md mx-auto flex flex-col gap-6">
      <button onClick={onBack} className="text-sm text-foreground-muted text-left hover:text-foreground">
        ← Back
      </button>
      <div>
        <h2 className="text-xl font-semibold">Complete your tip</h2>
        <p className="text-sm text-foreground-muted">Your request is already in the queue — this just moves it up.</p>
      </div>

      <div className="flex flex-col gap-4">
        {(applePayAvailable || googlePayAvailable) && (
          <div className="flex flex-col gap-2">
            {applePayAvailable && (
              <div
                id="apple-pay-button"
                onClick={() => handlePay(applePayRef.current)}
                className="h-12 rounded-lg overflow-hidden cursor-pointer"
              />
            )}
            {googlePayAvailable && (
              <div
                id="google-pay-button"
                onClick={() => handlePay(googlePayRef.current)}
                className="h-12 rounded-lg overflow-hidden cursor-pointer"
              />
            )}
            <p className="text-xs text-foreground-muted text-center">— or pay with card —</p>
          </div>
        )}

        <div id="square-card-container" className="rounded-lg border border-border bg-surface p-3" />
        {error && <p className="text-sm text-danger">{error}</p>}
        <button
          onClick={() => handlePay(cardRef.current)}
          disabled={submitting || !cardReady}
          className="rounded-lg bg-accent px-4 py-3 text-base font-medium text-accent-foreground hover:bg-accent-hover disabled:opacity-50"
        >
          {submitting ? "Processing…" : `Pay $${(amountCents / 100).toFixed(2)}`}
        </button>
      </div>
    </div>
  );
}
