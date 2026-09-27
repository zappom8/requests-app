import Link from "next/link";
import { getActiveSongDatabaseId } from "@/lib/settings";
import { getDefaultPerformer } from "@/lib/auth";
import { getPublicQueue } from "@/lib/queue";
import QueueList from "./QueueList";
import PromoLinks from "../PromoLinks";

// Initial paint must reflect the current queue — Realtime Broadcast then keeps it live.
export const dynamic = "force-dynamic";

export default async function QueuePage() {
  const performer = await getDefaultPerformer();
  const activeSongDatabaseId = await getActiveSongDatabaseId(performer.id);
  const queue = activeSongDatabaseId ? await getPublicQueue(activeSongDatabaseId) : [];

  return (
    <div className="min-h-screen w-full px-4 py-6 max-w-md mx-auto flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Queue</h1>
        <PromoLinks showBooking={false} />
        <Link href="/request" className="text-sm text-accent-hover hover:underline shrink-0">
          Request a song
        </Link>
      </div>
      {activeSongDatabaseId && (
        <QueueList initialQueue={queue} songDatabaseId={activeSongDatabaseId} />
      )}
    </div>
  );
}
