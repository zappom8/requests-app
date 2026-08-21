"use client";

// A Server Component formats dates in the server's (UTC) timezone, not the
// viewer's, and — being server-only — never gets a chance to re-render in
// the browser to fix that. Making this a Client Component means it actually
// runs in the browser on hydration, so the client's real local timezone is
// what ends up on screen; suppressHydrationWarning just silences the
// expected one-time mismatch against the server's UTC-rendered markup.
export default function LocalTime({ iso, dateOnly = false }: { iso: string; dateOnly?: boolean }) {
  const date = new Date(iso);
  const text = dateOnly
    ? date.toLocaleDateString([], { dateStyle: "short" })
    : date.toLocaleString([], { dateStyle: "short", timeStyle: "short" });

  return <span suppressHydrationWarning>{text}</span>;
}
