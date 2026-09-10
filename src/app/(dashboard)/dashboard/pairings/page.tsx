import { prisma } from "@/lib/prisma";
import SongPairingsManager from "./SongPairingsManager";

// Admin-facing, always needs current state — never statically cached.
export const dynamic = "force-dynamic";

export default async function SongPairingsPage() {
  const [songs, pairings] = await Promise.all([
    // Deduped across every database — the picker shouldn't show the same
    // song once per database it happens to be catalogued in.
    prisma.song.findMany({
      distinct: ["name", "artist"],
      orderBy: { name: "asc" },
      select: { name: true, artist: true },
    }),
    prisma.songPairing.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold mb-1">Song Pairings</h1>
        <p className="text-sm text-foreground-muted">
          When the first song is requested, the second is auto-added to the Live Queue as a linked song — no
          extra request needed, and it never counts in Statistics. Applies across every Song Database — the same
          pairing works wherever both songs are catalogued.
        </p>
      </div>

      <SongPairingsManager songs={songs} pairings={pairings} />
    </div>
  );
}
