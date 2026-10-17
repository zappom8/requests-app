"use client";

import { useState } from "react";
import { setCancelledArtists } from "@/actions/settings";

// The list of cancelled artists, saved with its own button. `counts` is how many
// songs each saved name currently hides (from the last save).
export default function CancelledArtistsEditor({
  initial,
  counts,
}: {
  initial: string[];
  counts: Record<string, number>;
}) {
  const [rows, setRows] = useState(initial.map((name, i) => ({ key: i, name })));
  const [nextKey, setNextKey] = useState(initial.length);

  return (
    <form action={setCancelledArtists} className="rounded-lg border border-border bg-surface p-4 space-y-3">
      <div>
        <h2 className="text-sm font-medium">Cancelled artists</h2>
        <p className="text-xs text-foreground-muted">
          Their songs stay in your databases but can&apos;t be requested (no showing in the list or search) and
          aren&apos;t offered as bangers. Any artist name containing the text counts, so &quot;Ed Sheeran&quot; also
          hides &quot;Ed Sheeran &amp; Taylor Swift&quot;. Remove a name and save to bring them back.
        </p>
      </div>
      {rows.length === 0 && <p className="text-xs text-foreground-muted">No cancelled artists.</p>}
      {rows.map((r) => (
        <div key={r.key} className="flex items-center gap-2">
          <input
            type="text"
            name="cancelledArtist"
            defaultValue={r.name}
            placeholder="Artist name"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
          {r.name && counts[r.name] !== undefined && (
            <span className="text-xs text-foreground-muted whitespace-nowrap">{counts[r.name]} songs hidden</span>
          )}
          <button
            type="button"
            onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
            className="text-xs font-medium text-danger hover:underline"
          >
            Remove
          </button>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setRows((rs) => [...rs, { key: nextKey, name: "" }]);
            setNextKey((k) => k + 1);
          }}
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:border-accent"
        >
          + Add an artist
        </button>
        <button
          type="submit"
          className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-accent-foreground hover:bg-accent-hover"
        >
          Save cancelled artists
        </button>
      </div>
    </form>
  );
}
