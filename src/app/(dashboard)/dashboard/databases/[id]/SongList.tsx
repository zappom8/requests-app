"use client";

import { useMemo, useState } from "react";
import SongRow from "./SongRow";

export default function SongList({
  songDatabaseId,
  songs,
}: {
  songDatabaseId: string;
  songs: { id: string; name: string; artist: string; decade: string | null }[];
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return songs;
    return songs.filter((s) => s.name.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q));
  }, [songs, query]);

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search songs or artists…"
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
      />

      <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
        {filtered.map((song) => (
          <SongRow
            key={song.id}
            id={song.id}
            songDatabaseId={songDatabaseId}
            name={song.name}
            artist={song.artist}
            decade={song.decade}
          />
        ))}
        {filtered.length === 0 && (
          <li className="px-4 py-6 text-sm text-foreground-muted text-center">
            {songs.length === 0 ? "No songs yet — add one above." : "No songs match your search."}
          </li>
        )}
      </ul>
    </div>
  );
}
