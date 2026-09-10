import { getActiveSongDatabaseId } from "@/lib/settings";
import { getAdminQueue } from "@/lib/queue";
import LiveQueueList from "./LiveQueueList";

// Always needs current queue state — never statically cached.
export const dynamic = "force-dynamic";

export default async function LiveQueuePage() {
  const activeSongDatabaseId = await getActiveSongDatabaseId();
  const queue = activeSongDatabaseId ? await getAdminQueue(activeSongDatabaseId) : [];

  if (!activeSongDatabaseId) {
    return <p className="text-foreground-muted">No song database is active right now.</p>;
  }

  // Serialize Date -> string so the client component's shape matches what
  // it gets back from /api/dashboard/queue (plain JSON) on every refetch.
  const serialized = queue.map((item) => ({ ...item, requestedAt: item.requestedAt.toISOString() }));

  return (
    // The dashboard layout's <main> caps every page at max-w-3xl for the
    // simple form/list pages (Settings, History, etc.) — fine there, but it
    // silently capped this grid at ~736px no matter how wide the window
    // was. This is the one page that wants the full window: the standard
    // "full-bleed" trick (100vw + negative-margin recentre) breaks it out
    // of that ancestor constraint without touching the shared layout.
    <div className="w-screen ml-[50%] -translate-x-1/2 px-4 sm:px-6">
      <LiveQueueList initialQueue={serialized} songDatabaseId={activeSongDatabaseId} />
    </div>
  );
}
