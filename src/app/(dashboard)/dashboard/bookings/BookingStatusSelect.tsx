"use client";

import { useState } from "react";
import { updateBookingInquiryStatus } from "@/actions/booking";
import type { InquiryStatus } from "@/generated/prisma/client";

const STATUSES: InquiryStatus[] = ["NEW", "CONTACTED", "CLOSED"];

export default function BookingStatusSelect({ id, status }: { id: string; status: InquiryStatus }) {
  const [current, setCurrent] = useState(status);
  const [saving, setSaving] = useState(false);

  async function handleChange(next: InquiryStatus) {
    const previous = current;
    setCurrent(next);
    setSaving(true);
    const result = await updateBookingInquiryStatus(id, next);
    setSaving(false);
    if (!result.success) setCurrent(previous);
  }

  return (
    <select
      value={current}
      disabled={saving}
      onChange={(e) => handleChange(e.target.value as InquiryStatus)}
      className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-accent disabled:opacity-50"
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}
