import {
  resolveDateRange,
  getOverview,
  getMostRequestedSongs,
  getMostProfitableSongs,
  getTopTippingSongsByAverage,
  getMostRequestedArtists,
  getMostRequestedDecades,
  getMostRequestedDatabases,
  getMonthly,
  getRequestsByDayOfWeek,
  getRequestsByHour,
  type RankedLabel,
  type RankedSong,
} from "@/lib/statistics";

export const dynamic = "force-dynamic";

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function SongList({ title, rows, moneyValue = false }: { title: string; rows: RankedSong[]; moneyValue?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <h2 className="text-sm font-medium mb-3">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-foreground-muted">No data yet.</p>
      ) : (
        <ol className="space-y-1.5 text-sm">
          {rows.map((r, i) => (
            <li key={`${r.songName}-${r.artistName}`} className="flex justify-between gap-3">
              <span className="text-foreground-muted shrink-0">{i + 1}.</span>
              <span className="flex-1">
                {r.songName} <span className="text-foreground-muted">— {r.artistName}</span>
              </span>
              <span className="font-medium shrink-0">{moneyValue ? money(r.value) : r.value}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function LabelList({ title, rows, moneyValue = false }: { title: string; rows: RankedLabel[]; moneyValue?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <h2 className="text-sm font-medium mb-3">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-foreground-muted">No data yet.</p>
      ) : (
        <ol className="space-y-1.5 text-sm">
          {rows.map((r) => (
            <li key={r.label} className="flex justify-between gap-3">
              <span className="flex-1">{r.label}</span>
              <span className="font-medium shrink-0">{moneyValue ? money(r.value) : r.value}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ dateFrom?: string; dateTo?: string }>;
}) {
  const sp = await searchParams;
  const range = resolveDateRange(sp.dateFrom, sp.dateTo);

  const [
    overview,
    mostRequestedSongs,
    mostProfitableSongs,
    topTippingSongs,
    mostRequestedArtists,
    mostRequestedDecades,
    mostRequestedDatabases,
    monthly,
    byDayOfWeek,
    byHour,
  ] = await Promise.all([
    getOverview(range),
    getMostRequestedSongs(range),
    getMostProfitableSongs(range),
    getTopTippingSongsByAverage(range),
    getMostRequestedArtists(range),
    getMostRequestedDecades(range),
    getMostRequestedDatabases(range),
    getMonthly(range),
    getRequestsByDayOfWeek(range),
    getRequestsByHour(range),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold mb-1">Statistics</h1>
        <p className="text-sm text-foreground-muted">All-time, unless filtered below.</p>
      </div>

      <form className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-foreground-muted">From</label>
          <input
            type="date"
            name="dateFrom"
            defaultValue={sp.dateFrom}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-foreground-muted">To</label>
          <input
            type="date"
            name="dateTo"
            defaultValue={sp.dateTo}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover"
        >
          Filter
        </button>
      </form>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs text-foreground-muted">Total requests</p>
          <p className="text-lg font-semibold">{overview.totalRequests}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs text-foreground-muted">Total tips</p>
          <p className="text-lg font-semibold text-tip">{money(overview.totalTipCents)}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs text-foreground-muted">Average tip</p>
          <p className="text-lg font-semibold">{money(overview.averageTipCents)}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs text-foreground-muted">Tipped requests</p>
          <p className="text-lg font-semibold">{overview.tippedRequestCount}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <SongList title="Most Requested Songs" rows={mostRequestedSongs} />
        <SongList title="Most Profitable Songs" rows={mostProfitableSongs} moneyValue />
        <SongList title="Top Tipping Songs (avg tip)" rows={topTippingSongs} moneyValue />
        <LabelList title="Most Requested Artists" rows={mostRequestedArtists} />
        <LabelList title="Most Requested Decades" rows={mostRequestedDecades} />
        <LabelList title="Most Requested Databases" rows={mostRequestedDatabases} />
        <LabelList title="Requests by Day of Week" rows={byDayOfWeek} />
        <LabelList title="Requests by Hour" rows={byHour} />
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-medium mb-3">Requests &amp; Tips per Month</h2>
        {monthly.length === 0 ? (
          <p className="text-sm text-foreground-muted">No data yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-foreground-muted">
                <th className="pb-2 font-medium">Month</th>
                <th className="pb-2 font-medium">Requests</th>
                <th className="pb-2 font-medium">Tips</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {monthly.map((m) => (
                <tr key={m.month}>
                  <td className="py-1.5">{m.month}</td>
                  <td className="py-1.5">{m.requests}</td>
                  <td className="py-1.5 text-tip">{money(m.tipCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
