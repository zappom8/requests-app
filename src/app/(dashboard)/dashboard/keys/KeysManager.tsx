"use client";

import { useMemo, useState } from "react";
import { setSongKey } from "@/actions/songKeys";

type Row = {
  songName: string;
  artistName: string;
  originalKey: string | null;
  lochiesKey: string | null;
  startChord: string | null;
  endChord: string | null;
  capo: string | null;
};
type Instrument = "guitar" | "piano";
type Field = "originalKey" | "lochiesKey" | "startChord" | "endChord" | "capo";

function KeyCell({ instrument, songName, artistName, field, initialValue }: { instrument: Instrument; songName: string; artistName: string; field: Field; initialValue: string | null }) {
  const [value, setValue] = useState(initialValue ?? "");
  const [savedValue, setSavedValue] = useState(initialValue ?? "");
  const [saving, setSaving] = useState(false);

  async function handleBlur() {
    if (value === savedValue) return;
    setSaving(true);
    const formData = new FormData();
    formData.set("instrument", instrument);
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
      onKeyDown={(e) => {
        // Up/Down (or Enter) moves to the same column in the next/previous row.
        const down = e.key === "ArrowDown" || (e.key === "Enter" && !e.shiftKey);
        const up = e.key === "ArrowUp" || (e.key === "Enter" && e.shiftKey);
        if (!down && !up) return;
        const td = e.currentTarget.closest("td");
        const tr = td?.parentElement;
        if (!td || !tr) return;
        const target = down ? tr.nextElementSibling : tr.previousElementSibling;
        const next = target?.children[td.cellIndex]?.querySelector("input");
        if (next) {
          e.preventDefault();
          next.focus();
          next.select();
        }
      }}
      placeholder="—"
      className={`w-full rounded-lg border bg-background px-2 py-1.5 text-sm outline-none focus:border-accent ${
        saving ? "border-accent" : "border-border"
      }`}
    />
  );
}

export default function KeysManager({ guitarRows, pianoRows }: { guitarRows: Row[]; pianoRows: Row[] }) {
  const [instrument, setInstrument] = useState<Instrument>("guitar");
  const rows = instrument === "guitar" ? guitarRows : pianoRows;
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.songName.toLowerCase().includes(q) || r.artistName.toLowerCase().includes(q));
  }, [rows, query]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(["guitar", "piano"] as const).map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => setInstrument(i)}
            className={`rounded-lg border px-4 py-1.5 text-sm font-medium capitalize ${
              instrument === i ? "border-accent bg-accent/10 text-foreground" : "border-border text-foreground-muted"
            }`}
          >
            {i}
          </button>
        ))}
      </div>
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
              <th className="w-32 px-3 py-2 font-medium">Starts on</th>
              <th className="w-32 px-3 py-2 font-medium">Ends on</th>
              {instrument === "guitar" && <th className="w-24 px-3 py-2 font-medium">Capo fret</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((r) => (
              <tr key={`${r.songName}::${r.artistName}`}>
                <td className="px-3 py-1.5 truncate max-w-[200px]">{r.songName}</td>
                <td className="px-3 py-1.5 truncate max-w-[200px] text-foreground-muted">{r.artistName}</td>
                <td className="px-2 py-1">
                  <KeyCell key={`${instrument}::${r.songName}::${r.artistName}`} instrument={instrument} songName={r.songName} artistName={r.artistName} field="originalKey" initialValue={r.originalKey} />
                </td>
                <td className="px-2 py-1">
                  <KeyCell key={`${instrument}::${r.songName}::${r.artistName}`} instrument={instrument} songName={r.songName} artistName={r.artistName} field="lochiesKey" initialValue={r.lochiesKey} />
                </td>
                <td className="px-2 py-1">
                  <KeyCell key={`${instrument}::${r.songName}::${r.artistName}`} instrument={instrument} songName={r.songName} artistName={r.artistName} field="startChord" initialValue={r.startChord} />
                </td>
                <td className="px-2 py-1">
                  <KeyCell key={`${instrument}::${r.songName}::${r.artistName}`} instrument={instrument} songName={r.songName} artistName={r.artistName} field="endChord" initialValue={r.endChord} />
                </td>
                {instrument === "guitar" && (
                  <td className="px-2 py-1">
                    <KeyCell key={`${instrument}::${r.songName}::${r.artistName}::capo`} instrument={instrument} songName={r.songName} artistName={r.artistName} field="capo" initialValue={r.capo} />
                  </td>
                )}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={instrument === "guitar" ? 7 : 6} className="px-3 py-6 text-center text-sm text-foreground-muted">
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
