"use client";

import { useState } from "react";

type Row = { key: number; dollars: string; message: string };

// Editable list of "from $X → message" rows. Submitted with the Settings
// form as parallel tierMin / tierMessage fields (see src/actions/settings.ts).
export default function TipThanksEditor({ initial }: { initial: { minCents: number; message: string }[] }) {
  const [rows, setRows] = useState<Row[]>(
    initial.map((t, i) => ({ key: i, dollars: String(t.minCents / 100), message: t.message }))
  );
  const [nextKey, setNextKey] = useState(initial.length);

  function update(key: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">Thank-you messages (shown after a tip goes through)</p>
      <p className="text-xs text-foreground-muted">
        Each message applies from its amount up to the next row. A tip of exactly $5 gets the &quot;$5&quot; message.
        Tips below your lowest row (or no rows at all) just see &quot;Thank you!&quot;.
      </p>
      {rows.map((r) => (
        <div key={r.key} className="flex items-center gap-2">
          <span className="text-sm text-foreground-muted">From $</span>
          <input
            type="number"
            name="tierMin"
            min="0"
            step="0.5"
            value={r.dollars}
            onChange={(e) => update(r.key, { dollars: e.target.value })}
            className="w-20 rounded-lg border border-border bg-background px-2 py-2 text-sm outline-none focus:border-accent"
          />
          <input
            type="text"
            name="tierMessage"
            maxLength={200}
            value={r.message}
            onChange={(e) => update(r.key, { message: e.target.value })}
            placeholder="Message (emojis welcome)"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
            className="text-xs font-medium text-danger hover:underline"
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => {
          setRows((rs) => [...rs, { key: nextKey, dollars: "", message: "" }]);
          setNextKey((k) => k + 1);
        }}
        className="self-start rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:border-accent"
      >
        + Add a bracket
      </button>
    </div>
  );
}
