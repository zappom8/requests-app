import { prisma } from "@/lib/prisma";
import { getCurrentVenueId } from "@/lib/settings";
import { getCurrentPerformer } from "@/lib/auth";
import BangersManager from "./BangersManager";
import VenuePicker from "./VenuePicker";

// Admin-facing, always needs current state — never statically cached.
export const dynamic = "force-dynamic";

export default async function BangersPage({
  searchParams,
}: {
  searchParams: Promise<{ venueId?: string }>;
}) {
  const sp = await searchParams;
  const performer = await getCurrentPerformer();
  const [venues, currentVenueId] = await Promise.all([
    prisma.venue.findMany({ where: { performerId: performer.id }, orderBy: { name: "asc" } }),
    getCurrentVenueId(performer.id),
  ]);

  // Only ever one of this performer's own venues, whatever the URL says.
  const ownVenueIds = new Set(venues.map((v) => v.id));
  const selectedVenueId =
    [sp.venueId, currentVenueId, venues[0]?.id].find((id): id is string => !!id && ownVenueIds.has(id)) ?? null;

  const [songs, bangers] = await Promise.all([
    // Deduped across every database — the picker shouldn't show the same
    // song once per database it happens to be catalogued in.
    prisma.song.findMany({
      where: { songDatabase: { performerId: performer.id } },
      distinct: ["name", "artist"],
      orderBy: { name: "asc" },
      select: { name: true, artist: true },
    }),
    selectedVenueId
      ? prisma.bangerSong.findMany({ where: { venueId: selectedVenueId }, orderBy: { songName: "asc" } })
      : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold mb-1">Bangers</h1>
        <p className="text-sm text-foreground-muted">
          Each venue has its own hype list. On the Live Queue, press{" "}
          <kbd className="rounded border border-border px-1.5 py-0.5 text-xs">B</kbd> to switch to Banger Mode — a
          filtered view showing only tipped requests, plus shout-outs for a song on the current venue&apos;s list.
          Doesn&apos;t change what the audience can request or what gets queued.
        </p>
      </div>

      <VenuePicker venues={venues} selectedVenueId={selectedVenueId} />

      {selectedVenueId && <BangersManager key={selectedVenueId} venueId={selectedVenueId} songs={songs} bangers={bangers} />}
    </div>
  );
}
