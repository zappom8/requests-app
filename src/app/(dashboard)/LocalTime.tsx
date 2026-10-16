// Dates are shown in Brisbane time (where the gigs are, and the timezone the
// statistics already use) — not whatever timezone the server happens to be in.
// An earlier version relied on the browser re-rendering in its own timezone, but
// React keeps the server-rendered (UTC) text when a hydration mismatch is
// suppressed, so the screen showed UTC. Using one fixed zone makes the server
// and browser output identical.
const TZ = "Australia/Brisbane";

export default function LocalTime({ iso, dateOnly = false }: { iso: string; dateOnly?: boolean }) {
  const date = new Date(iso);
  const text = dateOnly
    ? date.toLocaleDateString("en-AU", { dateStyle: "short", timeZone: TZ })
    : date.toLocaleString("en-AU", { dateStyle: "short", timeStyle: "short", timeZone: TZ });

  return <span>{text}</span>;
}
