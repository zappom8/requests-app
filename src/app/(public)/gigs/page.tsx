import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getUpcomingGigs, type Gig } from "@/lib/gigs";

export const dynamic = "force-dynamic";

// Gigs are tied to a real venue in a real place, not the viewer's own
// timezone (unlike e.g. dashboard timestamps) — always render in the gig's
// timezone, not whatever timezone the server happens to run in (Vercel's
// default is UTC, which without this showed a 5pm Brisbane gig as 7am).
const GIG_TIMEZONE = "Australia/Brisbane";
const dateFormatter = new Intl.DateTimeFormat("en-AU", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: GIG_TIMEZONE,
});
const monthFormatter = new Intl.DateTimeFormat("en-AU", { month: "short", timeZone: GIG_TIMEZONE });
const dayFormatter = new Intl.DateTimeFormat("en-AU", { day: "numeric", timeZone: GIG_TIMEZONE });
const timeFormatter = new Intl.DateTimeFormat("en-AU", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: GIG_TIMEZONE,
});

function GigCard({ gig }: { gig: Gig }) {
  // Prefer the event's own "URL" field (set in Calendar) so the venue's
  // actual website/Google listing can be linked instead of a generic Maps
  // search — falls back to that search when no URL is set on the event.
  const locationHref =
    gig.url ?? (gig.location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(gig.location)}` : null);

  const icsParams = new URLSearchParams({ title: gig.title, start: gig.start.toISOString() });
  if (gig.end) icsParams.set("end", gig.end.toISOString());
  if (gig.location) icsParams.set("location", gig.location);
  if (gig.url) icsParams.set("url", gig.url);
  const addToCalendarHref = `/api/gigs/ics?${icsParams.toString()}`;

  return (
    <li className="rounded-lg border border-border bg-surface p-4 flex gap-4">
      <a
        href={addToCalendarHref}
        title="Add to Calendar"
        className="flex flex-col items-center justify-center rounded-lg bg-surface-elevated px-3 py-2 text-center shrink-0 w-16 hover:bg-accent/20"
      >
        <span className="text-xs uppercase text-foreground-muted">{monthFormatter.format(gig.start)}</span>
        <span className="text-lg font-semibold leading-none">{dayFormatter.format(gig.start)}</span>
      </a>
      <div className="flex flex-col gap-0.5 min-w-0">
        {locationHref ? (
          <a
            href={locationHref}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium truncate hover:text-accent hover:underline"
          >
            {gig.title}
          </a>
        ) : (
          <p className="font-medium truncate">{gig.title}</p>
        )}
        {gig.location && locationHref && (
          <a
            href={locationHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-foreground-muted truncate hover:text-accent hover:underline"
          >
            {gig.location}
          </a>
        )}
        <p className="text-xs text-foreground-muted">
          {dateFormatter.format(gig.start)}
          {!gig.isFullDay && (
            <>
              {" "}
              · {timeFormatter.format(gig.start)}
              {gig.end && <> – {timeFormatter.format(gig.end)}</>}
            </>
          )}
        </p>
      </div>
    </li>
  );
}

export default async function GigsPage() {
  const settings = await prisma.settings.findUnique({ where: { id: 1 }, select: { gigsCalendarUrls: true } });
  const calendarUrls = settings?.gigsCalendarUrls ?? [];

  const { gigs, allFailed } = calendarUrls.length > 0 ? await getUpcomingGigs(calendarUrls) : { gigs: [], allFailed: false };

  return (
    <div className="min-h-screen w-full px-4 py-6 max-w-md mx-auto flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Upcoming Gigs</h1>
        <div className="flex items-center gap-3 text-sm shrink-0">
          <Link href="/request" className="text-accent hover:text-accent-hover">
            Request a Song
          </Link>
          <Link href="/book" className="text-accent hover:text-accent-hover">
            Book Lochie
          </Link>
        </div>
      </div>

      {calendarUrls.length === 0 && (
        <p className="text-foreground-muted text-center py-12">Check back soon for upcoming shows.</p>
      )}

      {calendarUrls.length > 0 && allFailed && (
        <p className="text-foreground-muted text-center py-12">
          Couldn&apos;t load the gig calendar right now. Please check back soon.
        </p>
      )}

      {calendarUrls.length > 0 && !allFailed && gigs.length === 0 && (
        <p className="text-foreground-muted text-center py-12">No upcoming gigs right now — check back soon.</p>
      )}

      {gigs.length > 0 && (
        <ul className="flex flex-col gap-3">
          {gigs.map((gig) => (
            <GigCard key={gig.uid} gig={gig} />
          ))}
        </ul>
      )}
    </div>
  );
}
