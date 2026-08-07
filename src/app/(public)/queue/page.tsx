import Link from "next/link";
import { getActiveSongDatabaseId } from "@/lib/settings";
import { getPublicQueue } from "@/lib/queue";
import QueueList from "./QueueList";

// Initial paint must reflect the current queue — Realtime Broadcast then keeps it live.
export const dynamic = "force-dynamic";

export default async function QueuePage() {
  const activeSongDatabaseId = await getActiveSongDatabaseId();
  const queue = activeSongDatabaseId ? await getPublicQueue(activeSongDatabaseId) : [];

  return (
    <div className="min-h-screen px-4 py-6 max-w-md mx-auto flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Queue</h1>
        <Link href="/request" className="text-sm text-accent-hover hover:underline">
          Request a song
        </Link>
      </div>
      {activeSongDatabaseId && (
        <QueueList initialQueue={queue} songDatabaseId={activeSongDatabaseId} />
      )}
    </div>
  );
}
