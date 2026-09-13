"use client";

import { useEffect, useRef, useState } from "react";
import type { AdminQueueItem } from "@/lib/queue";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { markPlayed, deleteRequest } from "@/actions/queue";
import { setCurrentVenue } from "@/actions/venues";
import { activateBangerMode } from "@/actions/bangers";
import { bangerKey } from "@/lib/bangerKey";

type SerializedItem = Omit<AdminQueueItem, "requestedAt"> & { requestedAt: string };
type Venue = { id: string; name: string };

const FALLBACK_POLL_MS = 30000;
// Marking several songs played in quick succession fires one broadcast per
// action — each triggers a refetch, and those requests can resolve out of
// order, letting a stale response overwrite a fresher optimistic state
// (an already-played song reappearing in the list). Debouncing collapses a
// burst of broadcasts into one refetch after things settle, and the
// sequence guard below drops any response that's no longer the latest one
// in flight, so this can't happen even under network reordering.
const REFETCH_DEBOUNCE_MS = 400;

export default function LiveQueueList({
  initialQueue,
  songDatabaseId,
  initialBangerKeys,
  venues,
  initialVenueId,
}: {
  initialQueue: SerializedItem[];
  songDatabaseId: string;
  initialBangerKeys: string[];
  venues: Venue[];
  initialVenueId: string | null;
}) {
  const [queue, setQueueState] = useState(initialQueue);
  const [bangerKeys, setBangerKeysState] = useState(new Set(initialBangerKeys));
  const [bangerMode, setBangerModeState] = useState(false);
  const [currentVenueId, setCurrentVenueIdState] = useState(initialVenueId);
  const [pendingActionId, setPendingActionIdState] = useState<string | null>(null);
  const refetchSeq = useRef(0);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const bangerActivationInFlight = useRef(false);

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

    const fallback = setInterval(refetchNow, FALLBACK_POLL_MS);

    return () => {
      cancelled = true;
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      clearInterval(fallback);
      channel.unsubscribe();
    };
  }, [songDatabaseId]);

  async function handlePlayed(item: SerializedItem) {
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

  // Banger Mode: turning it on stages every song on the current venue's
  // Bangers list as a real queue entry (see activateBangerMode — excluded
  // from Statistics and never shown on the public /queue page), then this
  // view narrows down to those plus any tipped request (any song — a tip
  // always signals "pay attention" regardless of what it's for). A plain,
  // untipped, non-banger request stays genuinely queued underneath, just
  // hidden from this view until Banger Mode is switched off again.
  const displayedQueue = computeDisplayedQueue(queue, bangerMode, bangerKeys);

  // Laptop workflow: cycling through the live queue at a gig, hands on the
  // keyboard — Space or Enter marks the top (next-up) request played
  // without reaching for the mouse, and B toggles Banger Mode. Registered
  // exactly once (see the refs above for why) rather than depending on
  // queue/pendingActionId/etc.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.toLowerCase() === "b") {
        e.preventDefault();
        const next = !bangerModeRef.current;
        setBangerModeState(next);
        bangerModeRef.current = next;
        // Guard against a second overlapping activation if B is pressed
        // again (e.g. impatience) before the first one has finished —
        // activateBangerMode is now fast, but this closes the race
        // entirely rather than just narrowing its window.
        if (next && !bangerActivationInFlight.current) {
          bangerActivationInFlight.current = true;
          void activateBangerMode(songDatabaseIdRef.current, currentVenueIdRef.current).finally(() => {
            bangerActivationInFlight.current = false;
          });
        }
        return;
      }
      if (e.code !== "Space" && e.key !== "Enter") return;
      e.preventDefault();
      const top = computeDisplayedQueue(queueRef.current, bangerModeRef.current, bangerKeysRef.current)[0];
      if (top && pendingActionIdRef.current !== top.id) handlePlayed(top);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">Live Queue</h1>
          {bangerMode && (
            <span className="rounded-full bg-tip/20 px-3 py-1 text-xs font-bold text-tip">
              🔥 BANGER MODE — press B to exit
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
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

      {displayedQueue.length === 0 ? (
        <p className="text-foreground-muted text-center py-12">
          {bangerMode ? "No bangers in the queue right now." : "Queue is empty."}
        </p>
      ) : (
        <ul className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(240px,1fr))]">
          {displayedQueue.map((item) => (
            <li key={item.id} className="rounded-xl border border-border bg-surface overflow-hidden">
              {item.linkedSongs.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 bg-accent/15 px-4 py-1.5 text-xs font-medium text-accent-hover">
                  <span>🔗 Also cues:</span>
                  {item.linkedSongs.map((s, i) => (
                    <span key={i} className="rounded-full bg-accent/20 px-2 py-0.5">
                      {s.songName} — {s.artistName}
                    </span>
                  ))}
                </div>
              )}
              <div className="p-4 flex flex-row sm:flex-col gap-3">
                <div className="flex-1 min-w-0 flex flex-col gap-3">
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
                    <p className="text-xs text-foreground-muted whitespace-nowrap" suppressHydrationWarning>
                      {new Date(item.requestedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                    </p>
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

                  <button
                    onClick={() => handleDelete(item)}
                    disabled={pendingActionId === item.id}
                    className="self-start rounded-lg border border-danger/50 px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/10 disabled:opacity-50"
                  >
                    DELETE
                  </button>
                </div>

                <button
                  onClick={() => handlePlayed(item)}
                  disabled={pendingActionId === item.id}
                  className="w-24 sm:w-full sm:h-9 shrink-0 rounded-xl bg-success text-background text-lg sm:text-sm font-bold disabled:opacity-50 flex items-center justify-center"
                >
                  PLAYED
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
