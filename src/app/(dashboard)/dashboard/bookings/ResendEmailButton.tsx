"use client";

import { useState } from "react";
import { resendBookingInquiryEmail } from "@/actions/booking";

export default function ResendEmailButton({ id }: { id: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");

  async function handleClick() {
    setState("sending");
    const result = await resendBookingInquiryEmail(id);
    setState(result.success ? "sent" : "failed");
    setTimeout(() => setState("idle"), 3000);
  }

  return (
    <button
      onClick={handleClick}
      disabled={state === "sending"}
      className="rounded-lg border border-border px-2 py-1.5 text-sm hover:border-accent disabled:opacity-50"
    >
      {state === "sending" ? "Sending…" : state === "sent" ? "Sent ✓" : state === "failed" ? "Failed" : "Email me this"}
    </button>
  );
}
