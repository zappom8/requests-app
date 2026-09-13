"use client";

import { useMemo, useState } from "react";
import { addBangers, removeBanger } from "@/actions/bangers";

type SongOption = { name: string; artist: string };
type Banger = { id: string; songName: string; artistName: string };

function songKey(s: SongOption): string {
  return `${s.name}::${s.artist}`;
}

export default function BangersManager({
  venueId,
  songs,
  bangers,
}: {
  venueId: string;
  songs: SongOption[];
  bangers: Banger[];
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);

  const availableSongs = useMemo(
    () => songs.filter((s) => !bangers.some((b) => b.songName === s.name && b.artistName === s.artist)),
    [songs, bangers]
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return availableSongs;
    return availableSongs.filter((s) => s.name.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q));
  }, [availableSongs, query]);

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAllFiltered() {
    const filteredKeys = filtered.map(songKey);
    const allSelected = filteredKeys.every((k) => selected.has(k));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const k of filteredKeys) {
        if (allSelected) next.delete(k);
        else next.add(k);
      }
      return next;
    });
  }

  async function handleAddSelected() {
    const toAdd = availableSongs
      .filter((s) => selected.has(songKey(s)))
      .map((s) => ({ songName: s.name, artistName: s.artist }));
    if (toAdd.length === 0) return;

    setAdding(true);
    const formData = new FormData();
    formData.set("venueId", venueId);
    formData.set("songs", JSON.stringify(toAdd));
    try {
      await addBangers(formData);
      setSelected(new Set());
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2 rounded-lg border border-border bg-surface p-4">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search songs…"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={handleAddSelected}
            disabled={selected.size === 0 || adding}
            className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover disabled:opacity-50"
          >
            Add {selected.size > 0 ? `${selected.size} ` : ""}selected
          </button>
        </div>

        {filtered.length > 0 && (
          <button type="button" onClick={toggleAllFiltered} className="text-xs font-medium text-accent-hover hover:underline">
            {filtered.every((s) => selected.has(songKey(s))) ? "Deselect all" : "Select all"}
            {query ? " (matching)" : ""}
          </button>
        )}

        <ul className="max-h-72 overflow-y-auto divide-y divide-border rounded-lg border border-border">
          {filtered.map((s) => {
            const key = songKey(s);
            return (
              <li key={key}>
                <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-background">
                  <input
                    type="checkbox"
                    checked={selected.has(key)}
                    onChange={() => toggle(key)}
                    className="h-4 w-4 accent-accent"
                  />
                  <span className="min-w-0 truncate">
                    {s.name} <span className="text-foreground-muted">— {s.artist}</span>
                  </span>
                </label>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-foreground-muted">
              {availableSongs.length === 0 ? "Every song is already a banger here." : "No songs match your search."}
            </li>
          )}
        </ul>
      </div>

      {bangers.length === 0 ? (
        <p className="text-sm text-foreground-muted">No bangers yet — add some above.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {bangers.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="min-w-0 truncate">
                <span className="font-medium">{b.songName}</span>{" "}
                <span className="text-foreground-muted">— {b.artistName}</span>
              </span>
              <form action={removeBanger}>
                <input type="hidden" name="id" value={b.id} />
                <button type="submit" className="shrink-0 text-xs font-medium text-danger hover:underline">
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
