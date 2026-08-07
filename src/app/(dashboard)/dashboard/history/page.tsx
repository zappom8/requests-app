import { prisma } from "@/lib/prisma";
import { getRequestHistory, type HistoryFilters } from "@/lib/history";
import type { RequestStatus } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS: RequestStatus[] = ["QUEUED", "PLAYED", "DELETED"];

type SearchParams = {
  song?: string;
  artist?: string;
  status?: string;
  songDatabaseId?: string;
  dateFrom?: string;
  dateTo?: string;
  tip?: string;
  cursor?: string;
  prevCursors?: string;
};

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

  const filters: HistoryFilters = {
    song: sp.song,
    artist: sp.artist,
    status: STATUS_OPTIONS.includes(sp.status as RequestStatus) ? (sp.status as RequestStatus) : undefined,
    songDatabaseId: sp.songDatabaseId,
    dateFrom: sp.dateFrom,
    dateTo: sp.dateTo,
    tip: sp.tip === "tipped" || sp.tip === "untipped" ? sp.tip : "any",
  };

  const cursor = sp.cursor ?? null;
  const prevCursorsStack = sp.prevCursors ? sp.prevCursors.split(",").filter(Boolean) : [];

  const [{ items, nextCursor }, databases] = await Promise.all([
    getRequestHistory(filters, cursor),
    prisma.songDatabase.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const filterParams = {
    song: sp.song,
    artist: sp.artist,
    status: sp.status,
    songDatabaseId: sp.songDatabaseId,
    dateFrom: sp.dateFrom,
    dateTo: sp.dateTo,
    tip: sp.tip,
  };

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
        <p className="text-sm text-foreground-muted">Every request ever made — nothing is ever deleted.</p>
      </div>

      <form className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-lg border border-border bg-surface p-4">
        <input
          type="text"
          name="song"
          defaultValue={sp.song}
          placeholder="Song"
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <input
          type="text"
          name="artist"
          defaultValue={sp.artist}
          placeholder="Artist"
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <select
          name="status"
          defaultValue={sp.status ?? ""}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        >
          <option value="">Any status</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          name="songDatabaseId"
          defaultValue={sp.songDatabaseId ?? ""}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        >
          <option value="">Any database</option>
          {databases.map((db) => (
            <option key={db.id} value={db.id}>
              {db.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          name="dateFrom"
          defaultValue={sp.dateFrom}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <input
          type="date"
          name="dateTo"
          defaultValue={sp.dateTo}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <select
          name="tip"
          defaultValue={sp.tip ?? "any"}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        >
          <option value="any">Any tip</option>
          <option value="tipped">Tipped only</option>
          <option value="untipped">Untipped only</option>
        </select>
        <button
          type="submit"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover"
        >
          Filter
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-foreground-muted">
              <th className="px-4 py-2 font-medium">Song</th>
              <th className="px-4 py-2 font-medium">Requester</th>
              <th className="px-4 py-2 font-medium">Database</th>
              <th className="px-4 py-2 font-medium">Tip</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Time</th>
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
                <td className="px-4 py-2 text-foreground-muted">{item.databaseName}</td>
                <td className="px-4 py-2">
                  {item.tipAmountCents > 0 ? (
                    <span className="text-tip font-medium">${(item.tipAmountCents / 100).toFixed(2)}</span>
                  ) : (
                    <span className="text-foreground-muted">—</span>
                  )}
                </td>
                <td className="px-4 py-2 text-foreground-muted">{item.status}</td>
                <td className="px-4 py-2 text-foreground-muted whitespace-nowrap" suppressHydrationWarning>
                  {item.requestedAt.toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-foreground-muted">
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
