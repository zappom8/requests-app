"use client";

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";

export type SetlistDatabase = { id: string; name: string; songs: { name: string; artist: string }[] };

// What the Live Queue's once-registered keydown listener (and the guitar
// pad, which types into this page) drives while the Setlist view is showing.
export type SetlistHandle = { move: (delta: number) => void; choose: () => void };

// Remembered per browser: which song database the Setlist view shows (the
// full "Footdrums ALL" list, typically — not necessarily the active one
// people request from).
const DATABASE_KEY = "liveQueue.setlistDatabaseId";

// The whole setlist, for when nobody's requesting: scroll it (arrows / the
// pad's knob) and choose a song (F / Enter / its button), which opens it in
// forScore and cues its Ableton scene — the same "choose" as on a request.
export default function SetlistPanel({
  databases,
  defaultDatabaseId,
  onChoose,
  ref,
}: {
  databases: SetlistDatabase[];
  defaultDatabaseId: string;
  onChoose: (songName: string, artistName: string) => void;
  ref: Ref<SetlistHandle>;
}) {
  // Only ever mounted after clicking/typing into the Setlist view — never in
  // the server render — so reading localStorage up front is safe.
  const [databaseId, setDatabaseId] = useState(() => {
    try {
      const saved = localStorage.getItem(DATABASE_KEY);
      if (saved && databases.some((d) => d.id === saved)) return saved;
    } catch {}
    return defaultDatabaseId;
  });
  const [selected, setSelectedState] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const selectedRef = useRef(0);
  const rowRefs = useRef<(HTMLLIElement | null)[]>([]);

  const songs = [...(databases.find((d) => d.id === databaseId)?.songs ?? [])].sort(
    (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) || a.artist.localeCompare(b.artist),
  );
  // For the imperative move/choose calls from the page's keydown listener.
  const songsRef = useRef(songs);
  useEffect(() => {
    songsRef.current = songs;
  });

  function select(index: number) {
    const clamped = Math.max(0, Math.min(index, songsRef.current.length - 1));
    selectedRef.current = clamped;
    setSelectedState(clamped);
    rowRefs.current[clamped]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function choose(index: number) {
    const song = songsRef.current[index];
    if (!song) return;
    select(index);
    setChosen(`${song.name}\u0000${song.artist}`);
    onChoose(song.name, song.artist);
  }

  useImperativeHandle(ref, () => ({
    move: (delta) => select(selectedRef.current + delta),
    choose: () => choose(selectedRef.current),
  }));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-1.5 text-xs text-foreground-muted">
          List
          <select
            value={databaseId}
            onChange={(e) => {
              setDatabaseId(e.target.value);
              select(0);
              try {
                localStorage.setItem(DATABASE_KEY, e.target.value);
              } catch {}
            }}
            className="rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none focus:border-accent"
          >
            {databases.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <span className="text-sm text-foreground-muted">{songs.length} songs</span>
      </div>

      {songs.length === 0 ? (
        <p className="text-foreground-muted text-center py-12">This list has no songs.</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {songs.map((song, index) => {
            const isSelected = index === Math.min(selected, songs.length - 1);
            const isChosen = chosen === `${song.name}\u0000${song.artist}`;
            return (
              <li
                key={`${song.name}\u0000${song.artist}`}
                ref={(el) => {
                  rowRefs.current[index] = el;
                }}
                onClick={() => select(index)}
                className={`flex items-center gap-3 px-4 py-2.5 ${
                  isSelected ? "bg-accent/15 ring-2 ring-inset ring-accent" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">
                    {isChosen && <span className="text-accent">▶ </span>}
                    {song.name}
                  </p>
                  <p className="text-sm text-foreground-muted truncate">{song.artist}</p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    choose(index);
                  }}
                  title="Open in forScore and cue its Ableton scene (F)"
                  className="h-9 shrink-0 rounded-xl border border-accent px-3 text-xs font-bold text-accent hover:bg-accent/10"
                >
                  Choose
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
