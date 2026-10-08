import { prisma } from "@/lib/prisma";
import { getCurrentPerformer } from "@/lib/auth";
import { getRequestHistory, countRequestHistory, type HistoryFilters } from "@/lib/history";
import type { RequestStatus } from "@/generated/prisma/client";
import DeleteRequestButton from "./DeleteRequestButton";
import DeleteAllButton from "./DeleteAllButton";
import DateRangeInputs from "./DateRangeInputs";
import VenueFilterSelect from "../VenueFilterSelect";
import { getVenueFilter } from "@/lib/venueFilter";
import LocalTime from "../../LocalTime";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS: RequestStatus[] = ["QUEUED", "PLAYED", "DELETED"];

type SearchParams = {
  song?: string;
  artist?: string;
  requester?: string;
  status?: string;
  songDatabaseId?: string;
  dateFrom?: string;
  dateTo?: string;
  venueId?: string;
  tip?: string;
  cursor?: string;
  prevCursors?: string;
};

const CONTROL =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent";

function Field({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className="text-xs text-foreground-muted">{label}</label>
      {children}
    </div>
  );
}

function buildQueryString(params: Record<string, string | undefined>): string {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) usp.set(key, value);
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}

export default async function HistoryPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const performer = await getCurrentPerformer();
  const { venues, venueId } = await getVenueFilter(performer.id, sp.venueId);

  const filters: HistoryFilters = {
    song: sp.song,
    artist: sp.artist,
    requester: sp.requester,
    status: STATUS_OPTIONS.includes(sp.status as RequestStatus) ? (sp.status as RequestStatus) : undefined,
    songDatabaseId: sp.songDatabaseId,
    dateFrom: sp.dateFrom,
    dateTo: sp.dateTo,
    venueId,
    tip: sp.tip === "tipped" || sp.tip === "untipped" ? sp.tip : "any",
  };

  const cursor = sp.cursor ?? null;
  const prevCursorsStack = sp.prevCursors ? sp.prevCursors.split(",").filter(Boolean) : [];

  // Song/artist filter options come from the real catalog (every song in
  // this performer's databases), not from distinct names seen in Request
  // history — the latter is polluted with one-off test song/artist names
  // from testing the request flow, and wouldn't include catalog songs that
  // haven't been requested yet.
  const ownSongs = { songDatabase: { performerId: performer.id } };

  const [{ items, nextCursor }, databases, filteredCount, songRows, artistRows] = await Promise.all([
    getRequestHistory(filters, performer.id, cursor),
    prisma.songDatabase.findMany({
      where: { performerId: performer.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    countRequestHistory(filters, performer.id),
    prisma.song.findMany({ where: ownSongs, distinct: ["name"], select: { name: true }, orderBy: { name: "asc" } }),
    prisma.song.findMany({ where: ownSongs, distinct: ["artist"], select: { artist: true }, orderBy: { artist: "asc" } }),
  ]);
  const songNames = songRows.map((r) => r.name);
  const artistNames = artistRows.map((r) => r.artist);

  const filterParams = {
    song: sp.song,
    artist: sp.artist,
    requester: sp.requester,
    status: sp.status,
    songDatabaseId: sp.songDatabaseId,
    dateFrom: sp.dateFrom,
    dateTo: sp.dateTo,
    venueId,
    tip: sp.tip,
  };

  const anyDateHref = sp.dateFrom || sp.dateTo ? buildQueryString({ ...filterParams, dateFrom: undefined, dateTo: undefined }) : null;

  const nextHref = nextCursor
    ? buildQueryString({
        ...filterParams,
        cursor: nextCursor,
        prevCursors: [...prevCursorsStack, cursor ?? ""].join(","),
      })
    : null;

  const prevHref =
    prevCursorsStack.length > 0
      ? buildQueryString({
          ...filterParams,
          cursor: prevCursorsStack[prevCursorsStack.length - 1] || undefined,
          prevCursors: prevCursorsStack.slice(0, -1).join(","),
        })
      : cursor !== null
        ? buildQueryString(filterParams) // one back from page 2 -> page 1, no stack needed
        : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold mb-1">Request History</h1>
        <p className="text-sm text-foreground-muted">Every request ever made.</p>
      </div>

      <form className="grid grid-cols-1 sm:grid-cols-4 items-end gap-x-3 gap-y-4 rounded-lg border border-border bg-surface p-4">
        <VenueFilterSelect venues={venues} selectedVenueId={venueId} />
        <Field label="Database">
          <select name="songDatabaseId" defaultValue={sp.songDatabaseId ?? ""} className={CONTROL}>
            <option value="">Any database</option>
            {databases.map((db) => (
              <option key={db.id} value={db.id}>
                {db.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select name="status" defaultValue={sp.status ?? ""} className={CONTROL}>
            <option value="">Any status</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tip">
          <select name="tip" defaultValue={sp.tip ?? "any"} className={CONTROL}>
            <option value="any">Any tip</option>
            <option value="tipped">Tipped only</option>
            <option value="untipped">Untipped only</option>
          </select>
        </Field>
        <Field label="Song">
          <select name="song" defaultValue={sp.song ?? ""} className={CONTROL}>
            <option value="">Any song</option>
            {songNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Artist">
          <select name="artist" defaultValue={sp.artist ?? ""} className={CONTROL}>
            <option value="">Any artist</option>
            {artistNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Requester" className="sm:col-span-2">
          <input
            type="text"
            name="requester"
            defaultValue={sp.requester}
            placeholder="Requester contains…"
            className={CONTROL}
          />
        </Field>
        <div className="sm:col-span-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border pt-4">
          <DateRangeInputs dateFrom={sp.dateFrom} dateTo={sp.dateTo} />
          {anyDateHref !== null && (
            <a
              href={`/dashboard/history${anyDateHref}`}
              className="rounded-lg border border-border px-3 py-2 text-sm text-foreground-muted hover:text-accent hover:border-accent"
            >
              Any date
            </a>
          )}
          <button
            type="submit"
            className="sm:ml-auto rounded-lg bg-accent px-6 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover"
          >
            Filter
          </button>
        </div>
      </form>

      <div className="flex justify-end">
        <DeleteAllButton filters={filters} count={filteredCount} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-foreground-muted">
              <th className="px-4 py-2 font-medium">Song</th>
              <th className="px-4 py-2 font-medium">Requester</th>
              <th className="px-4 py-2 font-medium">Venue</th>
              <th className="px-4 py-2 font-medium">Database</th>
              <th className="px-4 py-2 font-medium">Tip</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Time</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-2">
                  <p className="font-medium">{item.songName}</p>
                  <p className="text-xs text-foreground-muted">{item.artistName}</p>
                </td>
                <td className="px-4 py-2">
                  <p>{item.billingName || item.requesterName}</p>
                  {item.wantsShoutOut && <p className="text-xs text-tip font-medium">⭐ Wants a shout-out</p>}
                </td>
                <td className="px-4 py-2 text-foreground-muted">{item.venueName ?? "—"}</td>
                <td className="px-4 py-2 text-foreground-muted">{item.databaseName}</td>
                <td className="px-4 py-2">
                  {item.tipAmountCents > 0 ? (
                    <span className="text-tip font-medium">${(item.tipAmountCents / 100).toFixed(2)}</span>
                  ) : (
                    <span className="text-foreground-muted">—</span>
                  )}
                </td>
                <td className="px-4 py-2 text-foreground-muted">{item.status}</td>
                <td className="px-4 py-2 text-foreground-muted whitespace-nowrap">
                  <LocalTime iso={item.requestedAt.toISOString()} />
                </td>
                <td className="px-4 py-2 text-right">
                  <DeleteRequestButton requestId={item.id} />
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-foreground-muted">
                  No requests match those filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between text-sm">
        {prevHref !== null ? (
          <a href={`/dashboard/history${prevHref}`} className="text-accent-hover hover:underline">
            ← Previous
          </a>
        ) : (
          <span />
        )}
        {nextHref !== null && (
          <a href={`/dashboard/history${nextHref}`} className="text-accent-hover hover:underline">
            Next →
          </a>
        )}
      </div>
    </div>
  );
}
