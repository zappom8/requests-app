"use client";

import { useEffect, useState } from "react";
import type { PublicQueueItem } from "@/lib/queue";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

// 30s fallback poll in case a broadcast is ever missed (dropped connection,
// tab backgrounded mid-reconnect, etc.) — real-time updates come from the
// Supabase Broadcast subscription below, this is just a safety net.
const FALLBACK_POLL_MS = 30000;

export default function QueueList({
  initialQueue,
  songDatabaseId,
}: {
  initialQueue: PublicQueueItem[];
  songDatabaseId: string;
}) {
  const [queue, setQueue] = useState(initialQueue);

  useEffect(() => {
    let cancelled = false;

    async function refetch() {
      try {
        const res = await fetch("/api/queue", { cache: "no-store" });
        const data = await res.json();
        if (!cancelled) setQueue(data.queue ?? []);
      } catch {
        // transient network error — next broadcast or fallback poll will retry
      }
    }

    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`queue:${songDatabaseId}`)
      .on("broadcast", { event: "queue-changed" }, () => {
        refetch();
      })
      .subscribe();

    const fallback = setInterval(refetch, FALLBACK_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(fallback);
      channel.unsubscribe();
    };
  }, [songDatabaseId]);

  if (queue.length === 0) {
    return <p className="text-sm text-foreground-muted text-center py-8">No requests in the queue yet.</p>;
  }

  return (
    <ol className="divide-y divide-border rounded-lg border border-border bg-surface">
      {queue.map((item, index) => (
        <li key={item.id} className="flex items-baseline gap-3 px-4 py-3">
          <span className="text-foreground-muted text-sm w-6 shrink-0">{index + 1}.</span>
          <div>
            <p className="font-medium">{item.songName}</p>
            <p className="text-xs text-foreground-muted">{item.artistName}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
