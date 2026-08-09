"use client";

import { useState } from "react";
import { refundTip } from "@/actions/payments";

export default function RefundButton({ requestId }: { requestId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setSubmitting(true);
    setError(null);
    const formData = new FormData();
    formData.set("requestId", requestId);
    const result = await refundTip(formData);
    if (!result.success) {
      setError(result.error);
      setSubmitting(false);
      setConfirming(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={submitting}
        className={`text-xs font-medium hover:underline disabled:opacity-50 ${confirming ? "text-danger" : "text-foreground-muted"}`}
      >
        {submitting ? "Refunding…" : confirming ? "Confirm refund?" : "Refund"}
      </button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
