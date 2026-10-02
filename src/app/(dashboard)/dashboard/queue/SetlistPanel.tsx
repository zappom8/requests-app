"use client";

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { bangerKey } from "@/lib/bangerKey";

export type SetlistDatabase = { id: string; name: string; songs: { name: string; artist: string }[] };

// What the Live Queue's once-registered keydown listener (and the guitar
// pad, which types into this page) drives while the Setlist view is showing.
// link: jump to the next song paired with the selected one in the database.
export type SetlistHandle = { move: (delta: number) => void; choose: () => void; link: () => void };

type Sublist = "full" | "bangers";

// A linked song's title for a setlist row: just the song name, cut short if it's long.
const SHORT_TITLE_MAX = 18;
function shortTitle(name: string): string {
  const trimmed = name.replace(/\s+/g, " ").trim();
  return trimmed.length > SHORT_TITLE_MAX ? `${trimmed.slice(0, SHORT_TITLE_MAX - 1).trimEnd()}…` : trimmed;
}

// Remembered per browser: which song database the Setlist view shows (the
// full "Footdrums ALL" list, typically — not necessarily the active one
// people request from).
const DATABASE_KEY = "liveQueue.setlistDatabaseId";

// The whole setlist, for when nobody's requesting: scroll it (arrows / the
// pad's knob) and choose a song (F / Enter / its button), which opens it in
// forScore and cues its Ableton scene — the same "choose" as on a request.
//
// Above the first song sits a picker row — Full set list / Banger mode —
// reached by scrolling up past the top; choosing it flips between the two
// (Banger mode shows only this venue's bangers, still scrolled and chosen
// the same way).
export default function SetlistPanel({
  databases,
  defaultDatabaseId,
  onChoose,
  bangerKeys,
  songLinks,
  onNotice,
  ref,
}: {
  databases: SetlistDatabase[];
  defaultDatabaseId: string;
  onChoose: (songName: string, artistName: string) => void;
  bangerKeys: Set<string>;
  // bangerKey(song) -> the songs paired with it in the database.
  songLinks: Record<string, { songName: string; artistName: string }[]>;
  onNotice: (text: string, ok: boolean) => void;
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
  const [sublist, setSublistState] = useState<Sublist>("full");
  // -1 is the Full set list / Banger mode picker row; 0.. are songs.
  const [selected, setSelectedState] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const selectedRef = useRef(0);
  const sublistRef = useRef<Sublist>("full");
  const rowRefs = useRef<(HTMLLIElement | null)[]>([]);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  // L's cycling: the song L was first pressed on, and how far round its group we are.
  const linkAnchor = useRef<{ key: string; name: string; artist: string; pos: number; selKey: string } | null>(null);

  const allSongs = [...(databases.find((d) => d.id === databaseId)?.songs ?? [])].sort(
    (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) || a.artist.localeCompare(b.artist),
  );
  const bangerSongs = allSongs.filter((s) => bangerKeys.has(bangerKey(s.name, s.artist)));
  const songs = sublist === "bangers" ? bangerSongs : allSongs;
  // For the imperative move/choose/link calls from the page's keydown listener.
  const songsRef = useRef(songs);
  useEffect(() => {
    songsRef.current = songs;
  });

  function select(index: number) {
    const clamped = Math.max(-1, Math.min(index, songsRef.current.length - 1));
    selectedRef.current = clamped;
    setSelectedState(clamped);
    if (clamped === -1) pickerRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    else rowRefs.current[clamped]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function setSublist(next: Sublist) {
    sublistRef.current = next;
    setSublistState(next);
    // Stay on the picker row; the user scrolls down into the new list.
    linkAnchor.current = null;
    selectedRef.current = -1;
    setSelectedState(-1);
  }

  function choose(index: number) {
    if (index === -1) {
      setSublist(sublistRef.current === "full" ? "bangers" : "full");
      return;
    }
    const song = songsRef.current[index];
    if (!song) return;
    select(index);
    setChosen(`${song.name}\u0000${song.artist}`);
    onChoose(song.name, song.artist);
  }

  // L: from the selected song, go to the next song paired with it in the
  // database, wrapping round the group (A → B → C → A). Like L on a request
  // card, it opens the song too (forScore + its Ableton scene). If that song
  // isn't in the list being shown (e.g. a paired song that isn't a banger), it
  // is still opened, just without moving the highlight.
  function link() {
    const current = songsRef.current[selectedRef.current];
    if (!current) {
      onNotice("Select a song first (L works on a song, not the picker)", false);
      return;
    }
    const entry = (l: { songName: string; artistName: string }) => ({ key: bangerKey(l.songName, l.artistName), name: l.songName, artist: l.artistName });
    const groupOf = (a: { key: string; name: string; artist: string }) => [a, ...(songLinks[a.key] ?? []).map(entry)];
    const currentEntry = { key: bangerKey(current.name, current.artist), name: current.name, artist: current.artist };
    let anchor = linkAnchor.current;
    // Continuing a cycle only if the highlight hasn't moved since L last ran.
    if (!anchor || anchor.selKey !== currentEntry.key) anchor = { ...currentEntry, pos: 0, selKey: currentEntry.key };
    const group = groupOf(anchor);
    if (group.length === 1) {
      onNotice(`${current.name} has no paired songs`, false);
      return;
    }
    const pos = (anchor.pos + 1) % group.length;
    const target = group[pos];
    const index = songsRef.current.findIndex((s) => bangerKey(s.name, s.artist) === target.key);
    if (index !== -1) {
      linkAnchor.current = { ...anchor, pos, selKey: target.key };
      choose(index);
    } else {
      linkAnchor.current = { ...anchor, pos, selKey: currentEntry.key };
      onChoose(target.name, target.artist);
      onNotice(`${target.name} isn't in this list, opened anyway`, true);
    }
  }

  useImperativeHandle(ref, () => ({
    move: (delta) => select(selectedRef.current + delta),
    choose: () => choose(selectedRef.current),
    link,
  }));

  const pickerSelected = selected === -1;

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
        <span className="text-sm text-foreground-muted">
          {songs.length} {sublist === "bangers" ? "bangers" : "songs"}
        </span>
      </div>

      <div
        ref={pickerRef}
        className={`flex items-center gap-2 rounded-xl border bg-surface px-3 py-2 ${
          pickerSelected ? "border-accent ring-2 ring-accent" : "border-border"
        }`}
      >
        {(
          [
            ["full", `Full set list (${allSongs.length})`],
            ["bangers", `🔥 Banger mode (${bangerSongs.length})`],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setSublist(value)}
            className={`rounded-lg px-3 py-1.5 text-sm font-bold ${
              sublist === value ? "bg-accent text-accent-foreground" : "text-foreground-muted hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
        {pickerSelected && <span className="ml-auto text-xs text-foreground-muted">F / Choose switches list</span>}
      </div>

      {songs.length === 0 ? (
        <p className="text-foreground-muted text-center py-12">
          {sublist === "bangers" ? "No bangers on this venue's list." : "This list has no songs."}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {songs.map((song, index) => {
            const isSelected = index === Math.min(selected, songs.length - 1);
            const isChosen = chosen === `${song.name}\u0000${song.artist}`;
            const links = songLinks[bangerKey(song.name, song.artist)] ?? [];
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
                  {links.length > 0 && (
                    <p
                      className="text-xs text-accent truncate"
                      title={`Linked (L): ${links.map((l) => l.songName).join(", ")}`}
                    >
                      🔗 {links.map((l) => shortTitle(l.songName)).join(" · ")}
                    </p>
                  )}
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
