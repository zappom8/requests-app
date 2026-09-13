import { resolveDateRange, DOW_LABELS } from "@/lib/statistics";
import { getMostSearchedTerms, getMostUnsuccessfulSearches, getSearchTotals } from "@/lib/search-analytics";

export const dynamic = "force-dynamic";

const LIMIT_OPTIONS = [20, 50, 100, 200];

export default async function SearchAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ dateFrom?: string; dateTo?: string; days?: string | string[]; limit?: string }>;
}) {
  const sp = await searchParams;
  const selectedDays = sp.days === undefined ? [] : Array.isArray(sp.days) ? sp.days : [sp.days];
  const range = resolveDateRange(sp.dateFrom, sp.dateTo, selectedDays);
  const limit = LIMIT_OPTIONS.includes(Number(sp.limit)) ? Number(sp.limit) : 20;

  const [totals, mostSearched, unsuccessful] = await Promise.all([
    getSearchTotals(range),
    getMostSearchedTerms(range, limit),
    getMostUnsuccessfulSearches(range, limit),
  ]);

  const exportParams = new URLSearchParams();
  if (sp.dateFrom) exportParams.set("dateFrom", sp.dateFrom);
  if (sp.dateTo) exportParams.set("dateTo", sp.dateTo);
  for (const d of selectedDays) exportParams.append("days", d);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold mb-1">Search Analytics</h1>
        <p className="text-sm text-foreground-muted">
          What people search for on the request page — useful for learning songs to add.
        </p>
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
        <div className="flex flex-col gap-1">
          <label className="text-xs text-foreground-muted">Days</label>
          <div className="flex flex-wrap gap-2 py-2">
            {DOW_LABELS.map((label, i) => (
              <label key={label} className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  name="days"
                  value={i}
                  defaultChecked={selectedDays.includes(String(i))}
                  className="h-4 w-4 accent-accent"
                />
                {label.slice(0, 3)}
              </label>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-foreground-muted">Show top</label>
          <select
            name="limit"
            defaultValue={String(limit)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          >
            {LIMIT_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover"
        >
          Filter
        </button>
        <a
          href={`/api/dashboard/search-analytics/export?${exportParams.toString()}`}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:border-accent hover:text-accent-hover"
        >
          Download full CSV
        </a>
      </form>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs text-foreground-muted">Total searches logged</p>
          <p className="text-lg font-semibold">{totals.total}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs text-foreground-muted">Unsuccessful searches</p>
          <p className="text-lg font-semibold">{totals.unsuccessful}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="text-sm font-medium mb-3">Most Searched Terms</h2>
          {mostSearched.length === 0 ? (
            <p className="text-sm text-foreground-muted">No searches logged yet.</p>
          ) : (
            <ol className="space-y-1.5 text-sm">
              {mostSearched.map((r, i) => (
                <li key={r.term} className="flex justify-between gap-3">
                  <span className="text-foreground-muted shrink-0">{i + 1}.</span>
                  <span className="flex-1">{r.term}</span>
                  <span className="font-medium shrink-0">{r.count}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="text-sm font-medium mb-3">Most Unsuccessful Searches</h2>
          <p className="text-xs text-foreground-muted mb-3">
            Songs people want but can&apos;t find — good candidates to add.
          </p>
          {unsuccessful.length === 0 ? (
            <p className="text-sm text-foreground-muted">No unsuccessful searches logged.</p>
          ) : (
            <ol className="space-y-1.5 text-sm">
              {unsuccessful.map((r, i) => (
                <li key={r.term} className="flex justify-between gap-3">
                  <span className="text-foreground-muted shrink-0">{i + 1}.</span>
                  <span className="flex-1">{r.term}</span>
                  <span className="font-medium shrink-0">{r.count}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
