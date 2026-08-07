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

  return <LiveQueueList initialQueue={serialized} songDatabaseId={activeSongDatabaseId} />;
}
