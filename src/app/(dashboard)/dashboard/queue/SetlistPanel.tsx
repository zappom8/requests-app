"use client";

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { bangerKey } from "@/lib/bangerKey";

export type SetlistDatabase = { id: string; name: string; songs: { name: string; artist: string }[] };

// What the Live Queue's once-registered keydown listener (and the guitar
// pad, which types into this page) drives while the Setlist view is showing.
// link: jump to the next song paired with the selected one in the database.
export type SetlistHandle = { move: (delta: number) => void; choose: () => void; link: () => void };

type Sublist = "full" | "bangers";

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
  // Which tile of a row's group is lit: that row's song itself (pos 0) or its linked
  // songs (pos 1, 2...), as on the Live Queue's request cards. A ref too, for L.
  const [linkFocus, setLinkFocusState] = useState<{ key: string; pos: number } | null>(null);
  const linkFocusRef = useRef<{ key: string; pos: number } | null>(null);
  function setLinkFocus(next: { key: string; pos: number } | null) {
    linkFocusRef.current = next;
    setLinkFocusState(next);
  }

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
    setLinkFocus(null);
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
    setLinkFocus({ key: bangerKey(song.name, song.artist), pos: 0 });
    onChoose(song.name, song.artist);
  }

  // L: light up the next tile of the selected row's group (the song, then each song
  // linked to it in the database, wrapping round), and open that song like L does on a
  // request card (forScore + its Ableton scene). The row stays selected, and the linked
  // song doesn't have to be in the list being shown (e.g. it isn't a banger).
  function link() {
    const current = songsRef.current[selectedRef.current];
    if (!current) {
      onNotice("Select a song first (L works on a song, not the picker)", false);
      return;
    }
    const key = bangerKey(current.name, current.artist);
    const links = songLinks[key] ?? [];
    if (links.length === 0) {
      onNotice(`${current.name} has no paired songs`, false);
      return;
    }
    const focus = linkFocusRef.current;
    // Starting a cycle on this row: the first L goes to the first linked song.
    const pos = focus && focus.key === key ? (focus.pos + 1) % (links.length + 1) : 1;
    const target = pos === 0 ? { songName: current.name, artistName: current.artist } : links[pos - 1];
    setLinkFocus({ key, pos });
    setChosen(`${target.songName}\u0000${target.artistName}`);
    onChoose(target.songName, target.artistName);
  }

  // A linked-song tile clicked: the same as cycling to it with L.
  function chooseLinked(rowIndex: number, key: string, pos: number, target: { songName: string; artistName: string }) {
    select(rowIndex);
    setLinkFocus({ key, pos });
    setChosen(`${target.songName}\u0000${target.artistName}`);
    onChoose(target.songName, target.artistName);
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
            const rowKey = bangerKey(song.name, song.artist);
            const links = songLinks[rowKey] ?? [];
            const linkLit = linkFocus?.key === rowKey && linkFocus.pos > 0; // one of its linked tiles is lit instead
            return (
              <li
                key={rowKey}
                ref={(el) => {
                  rowRefs.current[index] = el;
                }}
                onClick={() => select(index)}
                className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 ${
                  isSelected ? "bg-accent/15 ring-2 ring-inset ring-accent" : ""
                }`}
              >
                <div className="min-w-0 basis-full sm:basis-[26%] sm:shrink-0">
                  <p className="font-semibold truncate">
                    {isChosen && !linkLit && <span className="text-accent">▶ </span>}
                    {song.name}
                  </p>
                  <p className="text-sm text-foreground-muted truncate">{song.artist}</p>
                </div>
                {/* The songs linked to this one, side by side across the row. */}
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                  {links.map((l, i) => {
                    const lit = linkFocus?.key === rowKey && linkFocus.pos === i + 1;
                    return (
                      <button
                        key={`${l.songName}\u0000${l.artistName}`}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          chooseLinked(index, rowKey, i + 1, l);
                        }}
                        title={`${l.songName} — ${l.artistName} (L cycles through these)`}
                        className={`max-w-[18rem] truncate rounded-lg border px-3 py-1.5 text-sm ${
                          lit
                            ? "border-accent bg-accent/25 font-semibold text-foreground ring-1 ring-accent"
                            : "border-border text-foreground-muted hover:text-foreground"
                        }`}
                      >
                        {lit ? "▶ " : "🔗 "}
                        {l.songName}
                      </button>
                    );
                  })}
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
