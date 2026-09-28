"use client";

import { useMemo, useState } from "react";
import { setForScoreLink } from "@/actions/forscoreLinks";

type Row = { songName: string; artistName: string; title: string | null; setlist: string | null };
type Field = "title" | "setlist";

function LinkCell({
  songName,
  artistName,
  field,
  initialValue,
  placeholder,
}: {
  songName: string;
  artistName: string;
  field: Field;
  initialValue: string | null;
  placeholder: string;
}) {
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
      await setForScoreLink(formData);
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
      placeholder={placeholder}
      className={`w-full rounded-lg border bg-background px-2 py-1.5 text-sm outline-none focus:border-accent ${
        saving ? "border-accent" : "border-border"
      }`}
    />
  );
}

export default function ForScoreLinksManager({ rows }: { rows: Row[] }) {
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
              <th className="min-w-48 px-3 py-2 font-medium">forScore title</th>
              <th className="w-36 px-3 py-2 font-medium">Setlist</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((r) => (
              <tr key={`${r.songName}::${r.artistName}`}>
                <td className="px-3 py-1.5 max-w-[200px]">
                  <p className="truncate">{r.songName}</p>
                  <p className="truncate text-xs text-foreground-muted">{r.artistName}</p>
                </td>
                <td className="px-2 py-1">
                  <LinkCell songName={r.songName} artistName={r.artistName} field="title" initialValue={r.title} placeholder="—" />
                </td>
                <td className="px-2 py-1">
                  <LinkCell songName={r.songName} artistName={r.artistName} field="setlist" initialValue={r.setlist} placeholder="any" />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-sm text-foreground-muted">
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
