"use client";

import { useMemo, useState } from "react";
import { setSongKey } from "@/actions/songKeys";

type Row = { songName: string; artistName: string; originalKey: string | null; lochiesKey: string | null };
type Field = "originalKey" | "lochiesKey";

function KeyCell({ songName, artistName, field, initialValue }: { songName: string; artistName: string; field: Field; initialValue: string | null }) {
  const [value, setValue] = useState(initialValue ?? "");
  const [savedValue, setSavedValue] = useState(initialValue ?? "");
  const [saving, setSaving] = useState(false);

  async function handleBlur() {
    if (value === savedValue) return;
    setSaving(true);
    const formData = new FormData();
    formData.set("songName", songName);
    formData.set("artistName", artistName);
    formData.set("field", field);
    formData.set("value", value);
    try {
      await setSongKey(formData);
      setSavedValue(value);
    } finally {
      setSaving(false);
    }
  }

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
      placeholder="—"
      className={`w-full rounded-lg border bg-background px-2 py-1.5 text-sm outline-none focus:border-accent ${
        saving ? "border-accent" : "border-border"
      }`}
    />
  );
}

export default function KeysManager({ rows }: { rows: Row[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.songName.toLowerCase().includes(q) || r.artistName.toLowerCase().includes(q));
  }, [rows, query]);

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search songs or artists…"
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
      />

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface text-left text-xs text-foreground-muted">
              <th className="px-3 py-2 font-medium">Song</th>
              <th className="px-3 py-2 font-medium">Artist</th>
              <th className="w-32 px-3 py-2 font-medium">Original Key</th>
              <th className="w-32 px-3 py-2 font-medium">Lochie&apos;s Key</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((r) => (
              <tr key={`${r.songName}::${r.artistName}`}>
                <td className="px-3 py-1.5 truncate max-w-[200px]">{r.songName}</td>
                <td className="px-3 py-1.5 truncate max-w-[200px] text-foreground-muted">{r.artistName}</td>
                <td className="px-2 py-1">
                  <KeyCell songName={r.songName} artistName={r.artistName} field="originalKey" initialValue={r.originalKey} />
                </td>
                <td className="px-2 py-1">
                  <KeyCell songName={r.songName} artistName={r.artistName} field="lochiesKey" initialValue={r.lochiesKey} />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-sm text-foreground-muted">
                  {rows.length === 0 ? "No songs in any database yet." : "No songs match your search."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
