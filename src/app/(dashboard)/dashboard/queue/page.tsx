import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { syncCurrentVenue } from "@/lib/venueSchedule";
import { getActiveSongDatabaseId, getCurrentVenueId } from "@/lib/settings";
import { getCurrentPerformer } from "@/lib/auth";
import { getAdminQueue } from "@/lib/queue";
import { getBangerKeys } from "@/lib/bangers";
import { bangerKey } from "@/lib/bangerKey";
import LiveQueueList from "./LiveQueueList";


// The guitar pad's helper (~/LOOPER) finds this window by its title.
export const metadata: Metadata = { title: "OPERATOR · Live Queue" };

// Always needs current queue state — never statically cached.
export const dynamic = "force-dynamic";

export default async function LiveQueuePage() {
  const performer = await getCurrentPerformer();
  // Auto-pick the venue from the gigs calendar before reading it below.
  await syncCurrentVenue(performer.id).catch(() => null);
  const [activeSongDatabaseId, currentVenueId, venues, forScorePrograms, forScoreLinks, setlistDatabases, pairingMembers] = await Promise.all([
    getActiveSongDatabaseId(performer.id),
    getCurrentVenueId(performer.id),
    prisma.venue.findMany({
      where: { performerId: performer.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    // Global by song name+artist (see ForScoreProgram), so this covers any
    // song that can land in the queue regardless of the active database.
    prisma.forScoreProgram.findMany({
      where: { performerId: performer.id },
      select: { songName: true, artistName: true, program: true },
    }),
    // Same, for opening scores on the iPad receiver by title (no MIDI).
    prisma.forScoreLink.findMany({
      where: { performerId: performer.id, OR: [{ title: { not: null } }, { filename: { not: null } }] },
      select: { songName: true, artistName: true, title: true, filename: true, setlist: true },
    }),
    // Every song list, for the Setlist view (a couple of hundred rows at most).
    prisma.songDatabase.findMany({
      where: { performerId: performer.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true, songs: { select: { name: true, artist: true } } },
    }),
    // Song pairing groups, for the Setlist view's L key: songs linked in the
    // database, whether or not anyone has requested them.
    prisma.songPairingGroupMember.findMany({
      where: { performerId: performer.id },
      orderBy: [{ groupId: "asc" }, { createdAt: "asc" }],
      select: { groupId: true, songName: true, artistName: true },
    }),
  ]);

  // bangerKey(song) -> every other song that shares a pairing group with it.
  const songLinks: Record<string, { songName: string; artistName: string }[]> = {};
  const groups = new Map<string, { songName: string; artistName: string }[]>();
  for (const m of pairingMembers) {
    groups.set(m.groupId, [...(groups.get(m.groupId) ?? []), { songName: m.songName, artistName: m.artistName }]);
  }
  for (const members of groups.values()) {
    for (const me of members) {
      const key = bangerKey(me.songName, me.artistName);
      const others = members.filter((o) => o !== me);
      songLinks[key] = [
        ...(songLinks[key] ?? []),
        ...others.filter((o) => !(songLinks[key] ?? []).some((x) => x.songName === o.songName && x.artistName === o.artistName)),
      ];
    }
  }
  const [queue, bangerKeys] = await Promise.all([
    activeSongDatabaseId ? getAdminQueue(activeSongDatabaseId) : Promise.resolve([]),
    getBangerKeys(currentVenueId),
  ]);

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
      <LiveQueueList
        initialQueue={serialized}
        songDatabaseId={activeSongDatabaseId}
        initialBangerKeys={bangerKeys}
        venues={venues}
        initialVenueId={currentVenueId}
        setlistDatabases={setlistDatabases}
        songLinks={songLinks}
        forScorePrograms={Object.fromEntries(
          forScorePrograms.map((p) => [bangerKey(p.songName, p.artistName), p.program]),
        )}
        forScoreLinks={Object.fromEntries(
          forScoreLinks.map((l) => [
            bangerKey(l.songName, l.artistName),
            { title: l.title, filename: l.filename, setlist: l.setlist },
          ]),
        )}
      />
    </div>
  );
}
