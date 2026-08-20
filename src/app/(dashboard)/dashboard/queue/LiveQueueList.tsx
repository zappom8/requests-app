"use client";

import { useEffect, useState } from "react";
import type { AdminQueueItem } from "@/lib/queue";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { markPlayed, deleteRequest } from "@/actions/queue";

type SerializedItem = Omit<AdminQueueItem, "requestedAt"> & { requestedAt: string };

const FALLBACK_POLL_MS = 30000;

export default function LiveQueueList({
  initialQueue,
  songDatabaseId,
}: {
  initialQueue: SerializedItem[];
  songDatabaseId: string;
}) {
  const [queue, setQueue] = useState(initialQueue);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function refetch() {
      try {
        const res = await fetch("/api/dashboard/queue", { cache: "no-store" });
        const data = await res.json();
        if (!cancelled) setQueue(data.queue ?? []);
      } catch {
        // transient network error — next broadcast or fallback poll will retry
      }
    }

    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`queue:${songDatabaseId}`)
      .on("broadcast", { event: "queue-changed" }, () => refetch())
      .subscribe();

    const fallback = setInterval(refetch, FALLBACK_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(fallback);
      channel.unsubscribe();
    };
  }, [songDatabaseId]);

  async function handlePlayed(item: SerializedItem) {
    setPendingActionId(item.id);
    setQueue((q) => q.filter((i) => i.id !== item.id)); // optimistic
    try {
      await markPlayed(item.requestIds, songDatabaseId);
    } finally {
      setPendingActionId(null);
    }
  }

  async function handleDelete(item: SerializedItem) {
    setPendingActionId(item.id);
    setQueue((q) => q.filter((i) => i.id !== item.id)); // optimistic
    try {
      await deleteRequest(item.requestIds, songDatabaseId);
    } finally {
      setPendingActionId(null);
    }
  }

  // Laptop workflow: cycling through the live queue at a gig, hands on the
  // keyboard — Space or Enter marks the top (next-up) request played without
  // reaching for the mouse.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.code !== "Space" && e.key !== "Enter") return;
      e.preventDefault();
      const top = queue[0];
      if (top && pendingActionId !== top.id) handlePlayed(top);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [queue, pendingActionId]);

  if (queue.length === 0) {
    return <p className="text-foreground-muted text-center py-12">Queue is empty.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {queue.map((item) => (
        <li key={item.id} className="rounded-xl border border-border bg-surface p-4 flex gap-3">
          <div className="flex-1 min-w-0 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold">{item.songName}</p>
                <p className="text-foreground-muted">{item.artistName}</p>
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
              {item.wantsShoutOut && <p className="text-tip font-medium">⭐ Wants a shout-out</p>}
              {item.tipAmountCents > 0 && (
                <p className="text-tip font-semibold mt-1">Tipped ${(item.tipAmountCents / 100).toFixed(2)}</p>
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
            className="w-24 shrink-0 rounded-xl bg-success text-background text-lg font-bold disabled:opacity-50 flex items-center justify-center"
          >
            PLAYED
          </button>
        </li>
      ))}
    </ul>
  );
}
