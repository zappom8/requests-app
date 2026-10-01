"use client";

import { useEffect, useRef, useState } from "react";
import type { AdminQueueItem } from "@/lib/queue";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { markPlayed, deleteRequest } from "@/actions/queue";
import { setCurrentVenue } from "@/actions/venues";
import { bangerKey } from "@/lib/bangerKey";
import { useMidiOutput } from "@/lib/useMidiOutput";
import { useLiveControl } from "@/lib/liveControl/useLiveControl";
import { cueAbletonScene } from "@/actions/devices";
import SetlistPanel, { type SetlistDatabase, type SetlistHandle } from "./SetlistPanel";

type SerializedItem = Omit<AdminQueueItem, "requestedAt"> & { requestedAt: string };
type Venue = { id: string; name: string };
type ForScoreLink = { title: string | null; filename: string | null; setlist: string | null };

const FALLBACK_POLL_MS = 30000;
// Marking several songs played in quick succession fires one broadcast per
// action — each triggers a refetch, and those requests can resolve out of
// order, letting a stale response overwrite a fresher optimistic state
// (an already-played song reappearing in the list). Debouncing collapses a
// burst of broadcasts into one refetch after things settle, and the
// sequence guard below drops any response that's no longer the latest one
// in flight, so this can't happen even under network reordering.
const REFETCH_DEBOUNCE_MS = 400;
const FORSCORE_NOTICE_MS = 3000;

export default function LiveQueueList({
  initialQueue,
  songDatabaseId,
  initialBangerKeys,
  venues,
  initialVenueId,
  forScorePrograms,
  forScoreLinks,
  setlistDatabases,
  songLinks,
}: {
  // Every song database, for the Setlist view.
  setlistDatabases: SetlistDatabase[];
  // bangerKey(song) -> the songs paired with it in the database.
  songLinks: Record<string, { songName: string; artistName: string }[]>;
  initialQueue: SerializedItem[];
  songDatabaseId: string;
  initialBangerKeys: string[];
  venues: Venue[];
  initialVenueId: string | null;
  // bangerKey(songName, artistName) -> the MIDI Program Change whose
  // forScore "Open" command opens that song's chart (channel 1).
  forScorePrograms: Record<string, number>;
  // bangerKey(songName, artistName) -> the score to open by title on the
  // performer's iPad forScore receiver (no MIDI; see /dashboard/forscore).
  forScoreLinks: Record<string, ForScoreLink>;
}) {
  const [queue, setQueueState] = useState(initialQueue);
  const [bangerKeys, setBangerKeysState] = useState(new Set(initialBangerKeys));
  const [bangerMode] = useState(false); // the old queue-filter Banger Mode has no trigger now: bangers are a Setlist sub-list
  const [currentVenueId, setCurrentVenueIdState] = useState(initialVenueId);
  const [pendingActionId, setPendingActionIdState] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndexState] = useState(0);
  const [forScoreNotice, setForScoreNotice] = useState<{ text: string; ok: boolean } | null>(null);
  const forScoreNoticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // midi.send only reads refs inside the hook, so the copy captured by the
  // once-registered keydown listener below never goes stale; likewise
  // forScorePrograms is fixed for the page's lifetime.
  const midi = useMidiOutput();
  // Unlike midi, its send closes over state — read through a ref from the
  // once-registered keydown listener so it never goes stale.
  const liveControl = useLiveControl();
  const liveControlRef = useRef(liveControl);
  useEffect(() => {
    liveControlRef.current = liveControl;
  });
  const refetchSeq = useRef(0);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // One entry per currently-rendered card, in display order — measured to
  // figure out how many cards fit per row (the grid reflows with window
  // width, so this can't be a fixed constant) for Up/Down navigation.
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);

  // The keydown listener below is registered exactly once (empty deps) so
  // rapid repeated presses — five Space presses in under a second — can't
  // outrun React's render cycle and all land on the same stale snapshot of
  // "what's on top of the queue". These refs are updated synchronously at
  // every mutation site (not via a useEffect reacting to state, which would
  // have the same lag problem) so the handler always reads the true latest
  // value no matter how fast it fires.
  const queueRef = useRef(queue);
  const bangerKeysRef = useRef(bangerKeys);
  const bangerModeRef = useRef(bangerMode);
  const currentVenueIdRef = useRef(currentVenueId);
  const pendingActionIdRef = useRef(pendingActionId);
  // songDatabaseId is a stable prop for this component's lifetime (the
  // page only ever mounts one LiveQueueList per active database), so this
  // never needs to be kept in sync after the initial render.
  const songDatabaseIdRef = useRef(songDatabaseId);

  // Ids currently being marked played/deleted, from the moment the optimistic
  // removal happens until the server call confirms it. Several rapid
  // presses fire several concurrent markPlayed/deleteRequest calls that
  // don't all finish at the same speed — a broadcast-triggered refetch can
  // land in the gap and return a snapshot the slower ones haven't
  // committed to yet, which would otherwise resurrect them in the UI until
  // their own (delayed) confirmation arrives. Any incoming server snapshot
  // is filtered through this set so a still-in-flight removal can never be
  // un-done by a refetch that simply hasn't caught up yet.
  const pendingRemovals = useRef<Set<string>>(new Set());
  const selectedIndexRef = useRef(selectedIndex);

  // Queue (requests) or Setlist (the whole song list). Q / S switch — the
  // guitar pad's mode key types those — and keys act on whichever is showing.
  const [view, setViewState] = useState<"queue" | "setlist">("queue");
  const viewRef = useRef(view);
  function setView(next: "queue" | "setlist") {
    viewRef.current = next;
    setViewState(next);
  }
  const setlistRef = useRef<SetlistHandle>(null);
  // The window title says which view is showing, so the guitar pad's helper
  // (which finds this window by "Live Queue") can read it back.
  useEffect(() => {
    document.title = view === "setlist" ? "OPERATOR · Live Queue · Setlist" : "OPERATOR · Live Queue";
  }, [view]);

  function setSelectedIndex(next: number) {
    selectedIndexRef.current = next;
    setSelectedIndexState(next);
  }

  function setQueue(next: SerializedItem[]) {
    queueRef.current = next;
    setQueueState(next);
  }
  function applyServerQueue(next: SerializedItem[]) {
    setQueue(next.filter((item) => !pendingRemovals.current.has(item.id)));
  }
  function setBangerKeys(next: Set<string>) {
    bangerKeysRef.current = next;
    setBangerKeysState(next);
  }
  function setCurrentVenueId(next: string | null) {
    currentVenueIdRef.current = next;
    setCurrentVenueIdState(next);
  }
  function setPendingActionId(next: string | null) {
    pendingActionIdRef.current = next;
    setPendingActionIdState(next);
  }

  function computeDisplayedQueue(q: SerializedItem[], mode: boolean, keys: Set<string>) {
    return mode ? q.filter((item) => item.tipAmountCents > 0 || keys.has(bangerKey(item.songName, item.artistName))) : q;
  }

  // How many cards the grid is currently fitting per row — the grid is
  // auto-fill/minmax so this reflows with window width and can't be a
  // fixed constant. Cards sharing the first card's offsetTop are on the
  // same row (grid-auto-flow is row by default, so DOM order === visual
  // left-to-right, top-to-bottom order).
  function getColumnCount(length: number): number {
    const items = itemRefs.current;
    const first = items[0];
    if (length === 0 || !first) return 1;
    let count = 0;
    for (let i = 0; i < length; i++) {
      const el = items[i];
      if (!el || el.offsetTop !== first.offsetTop) break;
      count++;
    }
    return Math.max(count, 1);
  }

  useEffect(() => {
    let cancelled = false;

    async function refetchNow() {
      const seq = ++refetchSeq.current;
      try {
        const res = await fetch("/api/dashboard/queue", { cache: "no-store" });
        const data = await res.json();
        // Ignore this response if a newer refetch has started since it was
        // sent — otherwise a slower, older request can resolve after a
        // faster, newer one and clobber the fresher state with stale data.
        if (!cancelled && seq === refetchSeq.current) {
          applyServerQueue(data.queue ?? []);
          setBangerKeys(new Set(data.bangerKeys ?? []));
          setCurrentVenueId(data.currentVenueId ?? null);
        }
      } catch {
        // transient network error — next broadcast or fallback poll will retry
      }
    }

    function scheduleRefetch() {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(refetchNow, REFETCH_DEBOUNCE_MS);
    }

    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`queue:${songDatabaseId}`)
      .on("broadcast", { event: "queue-changed" }, () => scheduleRefetch())
      .subscribe();

    // Next.js's client-side router cache can serve a stale snapshot of
    // this page for a while after navigating away and back (e.g. to
    // History and back), even though the page itself is force-dynamic —
    // that cache lives in the browser, outside the page's own rendering.
    // Deleted/played items could briefly reappear on return, "undoing"
    // themselves only once a broadcast or the 30s fallback poll below
    // eventually caught up. Fetching live data immediately on mount closes
    // that window instead of waiting on either.
    refetchNow();

    const fallback = setInterval(refetchNow, FALLBACK_POLL_MS);

    return () => {
      cancelled = true;
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      clearInterval(fallback);
      channel.unsubscribe();
    };
  }, [songDatabaseId]);

  // Keeps keyboard navigation continuing sensibly from wherever the mouse
  // was just used too — e.g. click PLAYED on card 3, then switch to the
  // keyboard, and arrow keys/Space carry on from card 3's position rather
  // than wherever the selection last happened to be.
  function syncSelectionToItem(item: SerializedItem) {
    const list = computeDisplayedQueue(queueRef.current, bangerModeRef.current, bangerKeysRef.current);
    const index = list.findIndex((i) => i.id === item.id);
    if (index !== -1) setSelectedIndex(index);
  }

  async function handlePlayed(item: SerializedItem) {
    syncSelectionToItem(item);
    pendingRemovals.current.add(item.id);
    setPendingActionId(item.id);
    setQueue(queueRef.current.filter((i) => i.id !== item.id)); // optimistic
    try {
      await markPlayed(item.requestIds, songDatabaseIdRef.current);
    } finally {
      pendingRemovals.current.delete(item.id);
      setPendingActionId(null);
    }
  }

  async function handleDelete(item: SerializedItem) {
    syncSelectionToItem(item);
    pendingRemovals.current.add(item.id);
    setPendingActionId(item.id);
    setQueue(queueRef.current.filter((i) => i.id !== item.id)); // optimistic
    try {
      await deleteRequest(item.requestIds, songDatabaseIdRef.current);
    } finally {
      pendingRemovals.current.delete(item.id);
      setPendingActionId(null);
    }
  }

  function showForScoreNotice(text: string, ok: boolean) {
    setForScoreNotice({ text, ok });
    if (forScoreNoticeTimer.current) clearTimeout(forScoreNoticeTimer.current);
    forScoreNoticeTimer.current = setTimeout(() => setForScoreNotice(null), FORSCORE_NOTICE_MS);
  }

  // Prefers the iPad receiver (opens the score by its forScore title) when
  // this performer has one set up and the song is linked; otherwise sends
  // the song's Program Change on channel 1 — matching the raw "C0 xx" Open
  // command stored against each score in the forScore set list.
  // Which song of each card's pairing group was last opened in forScore:
  // 0 = the requested song, 1+ = item.linkedSongs[n - 1]. Drives L's cycling
  // and the highlight in the "Also cues" strip. A ref too, for the
  // once-registered keydown listener.
  const [forScorePos, setForScorePosState] = useState<Record<string, number>>({});
  const forScorePosRef = useRef<Record<string, number>>({});
  function setForScorePos(itemId: string, pos: number) {
    forScorePosRef.current = { ...forScorePosRef.current, [itemId]: pos };
    setForScorePosState(forScorePosRef.current);
  }

  async function handleOpenInForScore(item: SerializedItem) {
    syncSelectionToItem(item);
    setForScorePos(item.id, 0);
    await openSongInForScore(item.songName, item.artistName);
  }

  // L: the next song in the card's pairing group, wrapping back round to the
  // requested song — e.g. Angels → I'm Gonna Be → Sex on Fire → Angels.
  // Or a specific one, when a song in the "Also cues" strip is clicked.
  async function handleOpenLinked(item: SerializedItem, pos?: number) {
    syncSelectionToItem(item);
    const group = [{ songName: item.songName, artistName: item.artistName }, ...item.linkedSongs];
    if (group.length === 1) {
      showForScoreNotice(`${item.songName} has no paired songs`, false);
      return;
    }
    const next = pos ?? ((forScorePosRef.current[item.id] ?? 0) + 1) % group.length;
    setForScorePos(item.id, next);
    await openSongInForScore(group[next].songName, group[next].artistName);
  }

  async function openSongInForScore(songName: string, artistName: string) {
    // Whatever song goes up in forScore, Ableton follows to its scene (if the
    // laptop's pad helper is registered as an Ableton receiver in Settings).
    void cueAbletonScene({ action: "select", songName, artistName }).catch(() => {});
    const key = bangerKey(songName, artistName);
    const link = forScoreLinks[key];
    const program = forScorePrograms[key];
    const control = liveControlRef.current;
    if (link && (control.receivers.length > 0 || program === undefined)) {
      setForScoreNotice(null);
      await control.openScore({ ...link, songName, artistName });
      return;
    }
    if (program === undefined) {
      showForScoreNotice("No forScore score has been linked to this song yet.", false);
      return;
    }
    const sentTo = await midi.send([0xc0, program]);
    if (sentTo) showForScoreNotice(`Opened ${songName} in forScore`, true);
    else showForScoreNotice("No MIDI output — check the iPad connection", false);
  }

  // Banger Mode: turning it on stages every song on the current venue's
  // Bangers list as a real queue entry (see activateBangerMode — excluded
  // from Statistics and never shown on the public /queue page), then this
  // view narrows down to those plus any tipped request (any song — a tip
  // always signals "pay attention" regardless of what it's for). A plain,
  // untipped, non-banger request stays genuinely queued underneath, just
  // hidden from this view until Banger Mode is switched off again.
  const displayedQueue = computeDisplayedQueue(queue, bangerMode, bangerKeys);

  // Laptop workflow: cycling through the live queue at a gig, hands on the
  // keyboard. Arrow keys move a highlighted selection across/down the grid
  // (so you're not stuck only ever acting on the top card — e.g. skip past
  // "Blinding Lights" to play "I'm Gonna Be" further down without touching
  // the mouse), Space/Enter plays whatever's selected, Delete/Backspace
  // removes it, F opens it in forScore, and B toggles Banger Mode. Registered exactly once (see
  // the refs above for why) rather than depending on queue/pendingActionId/etc.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Don't hijack keys while a real form control has focus (e.g. the
      // venue <select> uses arrow keys itself to change its own value).
      const active = document.activeElement;
      const tag = active instanceof HTMLElement ? active.tagName : "";
      if (tag === "SELECT" || tag === "INPUT" || tag === "TEXTAREA") return;

      const key = e.key.toLowerCase();
      if (key === "q" || key === "s") {
        e.preventDefault();
        setView(key === "q" ? "queue" : "setlist");
        return;
      }
      // T flips whichever view is showing — the pad's toggle key sends this, so
      // it always acts on the page's real view rather than a guess at it.
      if (key === "t") {
        e.preventDefault();
        setView(viewRef.current === "queue" ? "setlist" : "queue");
        return;
      }
      // Setlist view: arrows scroll (past the top is the Full set list /
      // Banger mode picker), F / Enter choose, L jumps to the next song paired
      // with this one. Queue-only keys (Space played, Delete) do nothing here,
      // so a stray press can never mark a request played while browsing.
      if (viewRef.current === "setlist") {
        const setlist = setlistRef.current;
        if (!setlist) return;
        if (e.key === "ArrowDown" || e.key === "ArrowRight") setlist.move(1);
        else if (e.key === "ArrowUp" || e.key === "ArrowLeft") setlist.move(-1);
        else if (key === "f" || e.key === "Enter") setlist.choose();
        else if (key === "l") setlist.link();
        else return;
        e.preventDefault();
        return;
      }

      const isArrow = e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowRight";
      if (isArrow) {
        e.preventDefault();
        const list = computeDisplayedQueue(queueRef.current, bangerModeRef.current, bangerKeysRef.current);
        if (list.length === 0) return;
        const current = Math.min(selectedIndexRef.current, list.length - 1);
        const columns = getColumnCount(list.length);
        let next = current;
        if (e.key === "ArrowRight") next = current + 1;
        else if (e.key === "ArrowLeft") next = current - 1;
        else if (e.key === "ArrowDown") next = current + columns;
        else if (e.key === "ArrowUp") next = current - columns;
        const clamped = Math.max(0, Math.min(next, list.length - 1));
        setSelectedIndex(clamped);
        // preventDefault above stops the arrows scrolling the page, so keep
        // the selected card in view ourselves (no-op if it's already visible).
        itemRefs.current[clamped]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        return;
      }

      const isForScore = e.key.toLowerCase() === "f";
      const isLinked = e.key.toLowerCase() === "l";
      if (!isForScore && !isLinked && e.code !== "Space" && e.key !== "Enter" && e.key !== "Delete" && e.key !== "Backspace") return;
      e.preventDefault();
      const list = computeDisplayedQueue(queueRef.current, bangerModeRef.current, bangerKeysRef.current);
      if (list.length === 0) return;
      const target = list[Math.min(selectedIndexRef.current, list.length - 1)];
      if (!target || pendingActionIdRef.current === target.id) return;
      if (isForScore) void handleOpenInForScore(target);
      else if (isLinked) void handleOpenLinked(target);
      else if (e.key === "Delete" || e.key === "Backspace") handleDelete(target);
      else handlePlayed(target);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">Live Queue</h1>
          <div className="flex rounded-lg border border-border p-0.5 text-xs font-medium">
            {(["queue", "setlist"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                title={v === "queue" ? "Requests (Q)" : "Whole setlist (S)"}
                className={`rounded-md px-3 py-1 ${
                  view === v ? "bg-accent text-accent-foreground" : "text-foreground-muted hover:text-foreground"
                }`}
              >
                {v === "queue" ? "Queue" : "Setlist"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {liveControl.notice && !forScoreNotice && (
            <span
              className={`text-xs font-medium ${
                liveControl.notice.tone === "ok"
                  ? "text-success"
                  : liveControl.notice.tone === "error"
                    ? "text-danger"
                    : "text-foreground-muted"
              }`}
            >
              {liveControl.notice.text}
            </span>
          )}
          {!liveControl.notice && liveControl.selected && (
            <span className="text-xs text-foreground-muted" title="forScore receiver (change in Settings)">
              → {liveControl.selected.name}{" "}
              <span className={liveControl.selected.online ? "text-success" : ""}>
                {liveControl.selected.online ? "●" : "○"}
              </span>
            </span>
          )}
          {forScoreNotice && (
            <span className={`text-xs font-medium ${forScoreNotice.ok ? "text-success" : "text-danger"}`}>
              {forScoreNotice.text}
            </span>
          )}
          {midi.supported && midi.outputs.length > 1 && (
            <label className="flex items-center gap-1.5 text-xs text-foreground-muted">
              MIDI
              <select
                value={midi.selectedId ?? ""}
                onChange={(e) => midi.selectOutput(e.target.value)}
                className="max-w-32 rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none focus:border-accent"
              >
                {midi.outputs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex items-center gap-1.5 text-xs text-foreground-muted">
            Venue
            <select
              value={currentVenueId ?? ""}
              onChange={(e) => {
                const venueId = e.target.value;
                setCurrentVenueId(venueId || null);
                const formData = new FormData();
                formData.set("venueId", venueId);
                void setCurrentVenue(formData);
              }}
              className="rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none focus:border-accent"
            >
              <option value="">None</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          <span className="text-sm text-foreground-muted">
            {bangerMode ? `${displayedQueue.length} bangers` : `${queue.length} in queue`}
          </span>
        </div>
      </div>

      <p className="hidden sm:block text-xs text-foreground-muted -mt-2">
        {view === "queue"
          ? "Arrows select · Space played · F forScore + Ableton · L next paired song · Delete remove · S setlist"
          : "Arrows scroll (up past the top: Full set list / Banger mode) · F or Enter choose · L next paired song · Q back to requests"}
      </p>

      {view === "setlist" ? (
        <SetlistPanel
          ref={setlistRef}
          databases={setlistDatabases}
          defaultDatabaseId={songDatabaseId}
          onChoose={(songName, artistName) => void openSongInForScore(songName, artistName)}
          bangerKeys={bangerKeys}
          songLinks={songLinks}
          onNotice={showForScoreNotice}
        />
      ) : displayedQueue.length === 0 ? (
        <p className="text-foreground-muted text-center py-12">
          {bangerMode ? "No bangers in the queue right now." : "Queue is empty."}
        </p>
      ) : (
        <ul className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(240px,1fr))]">
          {displayedQueue.map((item, index) => (
            <li
              key={item.id}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              onClick={() => setSelectedIndex(index)}
              className={`rounded-xl border bg-surface overflow-hidden transition-shadow ${
                index === Math.min(selectedIndex, displayedQueue.length - 1)
                  ? "border-accent ring-2 ring-accent"
                  : "border-border"
              }`}
            >
              {item.linkedSongs.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 bg-accent/15 px-4 py-1.5 text-xs font-medium text-accent-hover">
                  <span>🔗 Also cues:</span>
                  {item.linkedSongs.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleOpenLinked(item, i + 1);
                      }}
                      title="Open in forScore (L cycles)"
                      className={`rounded-full px-2 py-0.5 ${
                        forScorePos[item.id] === i + 1
                          ? "bg-accent text-accent-foreground"
                          : "bg-accent/20 hover:bg-accent/30"
                      }`}
                    >
                      {forScorePos[item.id] === i + 1 && "▶ "}
                      {s.songName} — {s.artistName}
                    </button>
                  ))}
                </div>
              )}
              <div className="p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex items-start gap-2">
                    {item.tipAmountCents > 0 && (
                      <span className="text-2xl leading-none shrink-0" aria-hidden>
                        💰
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="text-lg font-semibold truncate">{item.songName}</p>
                      <p className="text-foreground-muted truncate">{item.artistName}</p>
                    </div>
                  </div>
                  {/* suppressHydrationWarning: locale/timezone-formatted time will
                      legitimately differ between server render and the browser
                      (e.g. server in one timezone, phone in another) — expected,
                      not a bug. */}
                  <div className="flex items-start gap-1 shrink-0">
                    <p className="text-xs text-foreground-muted whitespace-nowrap" suppressHydrationWarning>
                      {new Date(item.requestedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                    </p>
                    {/* Phone only — there's no Delete key there. Kept tiny on
                        purpose; the laptop deletes with the keyboard. */}
                    <button
                      onClick={() => handleDelete(item)}
                      disabled={pendingActionId === item.id}
                      aria-label={`Delete ${item.songName}`}
                      className="sm:hidden -mt-1.5 -mr-2 px-2 py-1 text-base leading-none text-danger/80 hover:text-danger disabled:opacity-50"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="text-sm">
                  <p>
                    Requested by <span className="font-medium">{item.requesterName}</span>
                    {item.otherRequesterCount > 0 &&
                      ` and ${item.otherRequesterCount} other${item.otherRequesterCount === 1 ? "" : "s"}`}
                  </p>
                  {item.shoutOutRequesterNames.length > 0 && (
                    <p className="text-tip font-medium">⭐ Shout-out for {item.shoutOutRequesterNames.join(", ")}</p>
                  )}
                  {item.tipAmountCents > 0 && (
                    <p className="text-tip font-semibold mt-1">
                      Tipped ${(item.tipAmountCents / 100).toFixed(2)}
                      {item.otherRequesterCount > 0 && ` by ${item.requesterName}`}
                    </p>
                  )}
                  {item.paymentStatus === "PENDING" && (
                    <p className="text-xs text-foreground-muted mt-1">Tip payment in progress…</p>
                  )}
                </div>

                {/* Phone: two big buttons side by side. Laptop (sm+): a slim
                    Played bar with a small forScore button — the keyboard
                    (Space / F / Delete) is the main way to act there, and
                    Delete is keyboard-only on purpose. */}
                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <button
                    onClick={() => void handleOpenInForScore(item)}
                    disabled={
                      forScorePrograms[bangerKey(item.songName, item.artistName)] === undefined &&
                      !forScoreLinks[bangerKey(item.songName, item.artistName)]
                    }
                    title="Open in forScore (F)"
                    className="h-14 sm:h-9 sm:px-3 shrink-0 rounded-xl border border-accent text-accent text-lg sm:text-xs font-bold hover:bg-accent/10 disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    forScore
                  </button>
                  <button
                    onClick={() => handlePlayed(item)}
                    disabled={pendingActionId === item.id}
                    title="Mark played (Space)"
                    className="h-14 sm:h-9 sm:flex-1 rounded-xl bg-success text-background text-lg sm:text-sm font-bold disabled:opacity-50"
                  >
                    PLAYED
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
