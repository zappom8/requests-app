"use client";

import { useState } from "react";
import { addBanger, removeBanger } from "@/actions/bangers";

type SongOption = { name: string; artist: string };
type Banger = { id: string; songName: string; artistName: string };

export default function BangersManager({
  venueId,
  songs,
  bangers,
}: {
  venueId: string;
  songs: SongOption[];
  bangers: Banger[];
}) {
  const [picked, setPicked] = useState("");
  const availableSongs = songs.filter((s) => !bangers.some((b) => b.songName === s.name && b.artistName === s.artist));
  const pickedSong = picked !== "" ? availableSongs[Number(picked)] : undefined;

  return (
    <div className="space-y-3">
      <form
        action={async (formData) => {
          await addBanger(formData);
          setPicked("");
        }}
        className="flex gap-2 rounded-lg border border-border bg-surface p-4"
      >
        <input type="hidden" name="venueId" value={venueId} />
        <select
          value={picked}
          onChange={(e) => setPicked(e.target.value)}
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        >
          <option value="" disabled>
            Choose a song…
          </option>
          {availableSongs.map((s, i) => (
            <option key={i} value={i}>
              {s.name} — {s.artist}
            </option>
          ))}
        </select>
        <input type="hidden" name="songName" value={pickedSong?.name ?? ""} />
        <input type="hidden" name="artistName" value={pickedSong?.artist ?? ""} />
        <button
          type="submit"
          disabled={picked === ""}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover disabled:opacity-50"
        >
          Add
        </button>
      </form>

      {bangers.length === 0 ? (
        <p className="text-sm text-foreground-muted">No bangers yet — add one above.</p>
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
