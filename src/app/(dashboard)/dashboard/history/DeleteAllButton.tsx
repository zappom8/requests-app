"use client";

import { useState } from "react";
import { deleteAllFilteredRequests } from "@/actions/requests";
import type { HistoryFilters } from "@/lib/history";

export default function DeleteAllButton({ filters, count }: { filters: HistoryFilters; count: number }) {
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (count === 0) return null;

  async function handleClick() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await deleteAllFilteredRequests(filters);
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
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover disabled:opacity-50"
      >
        {submitting ? "Deleting…" : confirming ? `Confirm delete all ${count}?` : `Delete all ${count}`}
      </button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
