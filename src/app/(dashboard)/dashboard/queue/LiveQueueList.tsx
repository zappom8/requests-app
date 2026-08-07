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

  async function handlePlayed(id: string) {
    setPendingActionId(id);
    setQueue((q) => q.filter((item) => item.id !== id)); // optimistic
    try {
      await markPlayed(id);
    } finally {
      setPendingActionId(null);
    }
  }

  async function handleDelete(id: string) {
    setPendingActionId(id);
    setQueue((q) => q.filter((item) => item.id !== id)); // optimistic
    try {
      await deleteRequest(id);
    } finally {
      setPendingActionId(null);
    }
  }

  if (queue.length === 0) {
    return <p className="text-foreground-muted text-center py-12">Queue is empty.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {queue.map((item) => (
        <li key={item.id} className="rounded-xl border border-border bg-surface p-4 flex flex-col gap-3">
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
            </p>
            {item.shoutOut && <p className="text-foreground-muted italic">&ldquo;{item.shoutOut}&rdquo;</p>}
            {item.tipAmountCents > 0 && (
              <p className="text-tip font-semibold mt-1">Tipped ${(item.tipAmountCents / 100).toFixed(2)}</p>
            )}
            {item.paymentStatus === "PENDING" && (
              <p className="text-xs text-foreground-muted mt-1">Tip payment in progress…</p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => handlePlayed(item.id)}
              disabled={pendingActionId === item.id}
              className="flex-1 rounded-lg bg-success px-4 py-3 text-base font-semibold text-background disabled:opacity-50"
            >
              PLAYED
            </button>
            <button
              onClick={() => handleDelete(item.id)}
              disabled={pendingActionId === item.id}
              className="flex-1 rounded-lg bg-danger px-4 py-3 text-base font-semibold text-background disabled:opacity-50"
            >
              DELETE
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
