"use client";

import { useState } from "react";
import { deleteBookingInquiry } from "@/actions/booking";

export default function DeleteInquiryButton({ id, name }: { id: string; name: string }) {
  const [deleting, setDeleting] = useState(false);

  async function handleClick() {
    if (!window.confirm(`Delete the booking inquiry from ${name}? This can't be undone.`)) return;
    setDeleting(true);
    const result = await deleteBookingInquiry(id);
    if (!result.success) setDeleting(false);
  }

  return (
    <button
      onClick={handleClick}
      disabled={deleting}
      className="rounded-lg border border-border px-2 py-1.5 text-sm text-red-400 hover:border-red-400 disabled:opacity-50"
    >
      {deleting ? "Deleting…" : "Delete"}
    </button>
  );
}
