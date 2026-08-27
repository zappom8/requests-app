"use client";

import { useState } from "react";
import Link from "next/link";
import { submitBookingInquiry } from "@/actions/booking";

export default function BookingForm() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await submitBookingInquiry(new FormData(e.currentTarget));
    setSubmitting(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-6">
        <h1 className="text-2xl font-semibold">Thanks — request sent!</h1>
        <p className="text-foreground-muted max-w-xs">Lochie will get back to you as soon as he can.</p>
        <Link
          href="/gigs"
          className="rounded-lg border border-border px-4 py-3 text-sm font-medium hover:border-accent text-center"
        >
          See Upcoming Gigs
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Honeypot: real visitors never see this field. Bots that blindly fill
          every input in the form will, and get silently no-op'd server-side. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
      />

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium" htmlFor="name">
          Your Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          className="rounded-lg border border-border bg-surface px-3 py-3 text-base outline-none focus:border-accent"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="rounded-lg border border-border bg-surface px-3 py-3 text-base outline-none focus:border-accent"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium" htmlFor="phone">
          Phone <span className="text-foreground-muted font-normal">(optional)</span>
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          className="rounded-lg border border-border bg-surface px-3 py-3 text-base outline-none focus:border-accent"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium" htmlFor="eventDate">
          Event Date <span className="text-foreground-muted font-normal">(optional)</span>
        </label>
        <input
          id="eventDate"
          name="eventDate"
          type="date"
          className="rounded-lg border border-border bg-surface px-3 py-3 text-base outline-none focus:border-accent"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium" htmlFor="location">
          Venue / Location <span className="text-foreground-muted font-normal">(optional)</span>
        </label>
        <input
          id="location"
          name="location"
          type="text"
          placeholder="e.g. The Local, Newtown"
          className="rounded-lg border border-border bg-surface px-3 py-3 text-base outline-none focus:border-accent"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium" htmlFor="message">
          Tell me about the event
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={4}
          placeholder="Type of event, expected crowd size, budget, timing..."
          className="rounded-lg border border-border bg-surface px-3 py-3 text-base outline-none focus:border-accent"
        />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-accent px-4 py-3 text-base font-medium text-accent-foreground hover:bg-accent-hover disabled:opacity-50"
      >
        {submitting ? "Sending…" : "Send Booking Request"}
      </button>
    </form>
  );
}
