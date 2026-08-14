"use client";

import { useState } from "react";
import { permanentlyDeleteRequest } from "@/actions/requests";

export default function DeleteRequestButton({ requestId }: { requestId: string }) {
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
    const result = await permanentlyDeleteRequest(requestId);
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
        className="text-xs font-medium text-accent hover:text-accent-hover hover:underline disabled:opacity-50"
      >
        {submitting ? "Deleting…" : confirming ? "Confirm delete?" : "Delete"}
      </button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
