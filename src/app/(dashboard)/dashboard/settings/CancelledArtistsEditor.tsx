"use client";

import { useState, useTransition } from "react";
import { setCancelledArtists } from "@/actions/settings";

// The list of cancelled artists, saved with its own button. `counts` (keyed by
// lowercase name) is how many songs each saved name currently hides.
export default function CancelledArtistsEditor({
  initial,
  counts: initialCounts,
}: {
  initial: string[];
  counts: Record<string, number>;
}) {
  const [rows, setRows] = useState(initial.map((name, i) => ({ key: i, name })));
  const [nextKey, setNextKey] = useState(initial.length);
  const [counts, setCounts] = useState(initialCounts);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [pending, startTransition] = useTransition();

  function update(key: number, name: string) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, name } : r)));
    setStatus("idle");
  }

  function save(formData: FormData) {
    startTransition(async () => {
      try {
        const result = await setCancelledArtists(formData);
        setCounts(result.counts);
        setStatus("saved");
      } catch {
        setStatus("error");
      }
    });
  }

  const hiddenTotal = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <form action={save} className="rounded-lg border border-border bg-surface p-4 space-y-3">
      <div>
        <h2 className="text-sm font-medium">Cancelled artists</h2>
        <p className="text-xs text-foreground-muted">
          Their songs stay in your databases but can&apos;t be requested (no showing in the list or search) and
          aren&apos;t offered as bangers. Any artist name containing the text counts, so &quot;Ed Sheeran&quot; also
          hides &quot;Ed Sheeran &amp; Taylor Swift&quot;. Remove a name and save to bring them back.
        </p>
      </div>
      {rows.length === 0 && <p className="text-xs text-foreground-muted">No cancelled artists.</p>}
      {rows.map((r) => {
        const count = counts[r.name.trim().toLowerCase()];
        return (
          <div key={r.key} className="flex items-center gap-2">
            <input
              type="text"
              name="cancelledArtist"
              value={r.name}
              onChange={(e) => update(r.key, e.target.value)}
              placeholder="Artist name"
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            />
            {count !== undefined && r.name.trim() && (
              <span className="text-xs text-foreground-muted whitespace-nowrap">{count} songs hidden</span>
            )}
            <button
              type="button"
              onClick={() => {
                setRows((rs) => rs.filter((x) => x.key !== r.key));
                setStatus("idle");
              }}
              className="text-xs font-medium text-danger hover:underline"
            >
              Remove
            </button>
          </div>
        );
      })}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setRows((rs) => [...rs, { key: nextKey, name: "" }]);
            setNextKey((k) => k + 1);
            setStatus("idle");
          }}
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:border-accent"
        >
          + Add an artist
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-accent-foreground hover:bg-accent-hover disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save cancelled artists"}
        </button>
        {status === "saved" && (
          <span className="text-sm font-medium text-success">
            Saved ✓ — {hiddenTotal} song{hiddenTotal === 1 ? "" : "s"} hidden
          </span>
        )}
        {status === "error" && <span className="text-sm font-medium text-danger">Couldn&apos;t save — try again</span>}
      </div>
    </form>
  );
}
