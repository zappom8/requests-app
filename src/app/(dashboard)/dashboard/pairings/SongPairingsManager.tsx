"use client";

import { useState } from "react";
import { createSongPairing, deleteSongPairing } from "@/actions/songPairings";

type SongOption = { name: string; artist: string };
type Pairing = {
  id: string;
  fromSongName: string;
  fromArtistName: string;
  toSongName: string;
  toArtistName: string;
};

export default function SongPairingsManager({ songs, pairings }: { songs: SongOption[]; pairings: Pairing[] }) {
  // <select> values are indexes into `songs` (name/artist can contain
  // anything, including the delimiter a concatenated key would need) —
  // resolved back to the real name/artist for the hidden form fields below.
  const [fromIndex, setFromIndex] = useState("");
  const [toIndex, setToIndex] = useState("");

  const fromSong = fromIndex !== "" ? songs[Number(fromIndex)] : undefined;
  const toSong = toIndex !== "" ? songs[Number(toIndex)] : undefined;

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <form
        action={async (formData) => {
          await createSongPairing(formData);
          setFromIndex("");
          setToIndex("");
        }}
        className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr_auto] items-center gap-2"
      >
        <select
          required
          value={fromIndex}
          onChange={(e) => setFromIndex(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        >
          <option value="" disabled>
            Requesting this song…
          </option>
          {songs.map((s, i) => (
            <option key={i} value={i}>
              {s.name} — {s.artist}
            </option>
          ))}
        </select>
        <input type="hidden" name="fromSongName" value={fromSong?.name ?? ""} />
        <input type="hidden" name="fromArtistName" value={fromSong?.artist ?? ""} />

        <span className="text-xs text-foreground-muted text-center">transitions into</span>

        <select
          required
          value={toIndex}
          onChange={(e) => setToIndex(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        >
          <option value="" disabled>
            …auto-adds this song
          </option>
          {songs.map((s, i) => (
            <option key={i} value={i}>
              {s.name} — {s.artist}
            </option>
          ))}
        </select>
        <input type="hidden" name="toSongName" value={toSong?.name ?? ""} />
        <input type="hidden" name="toArtistName" value={toSong?.artist ?? ""} />

        <button
          type="submit"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover"
        >
          Link
        </button>
      </form>

      {pairings.length === 0 ? (
        <p className="text-sm text-foreground-muted">No pairings yet — link two songs above.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {pairings.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="min-w-0 truncate">
                <span className="font-medium">{p.fromSongName}</span>{" "}
                <span className="text-foreground-muted">({p.fromArtistName})</span>
                <span className="text-foreground-muted mx-1.5">→</span>
                <span className="font-medium">{p.toSongName}</span>{" "}
                <span className="text-foreground-muted">({p.toArtistName})</span>
              </span>
              <form action={deleteSongPairing}>
                <input type="hidden" name="id" value={p.id} />
                <button type="submit" className="shrink-0 text-xs font-medium text-danger hover:underline">
                  Unlink
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
