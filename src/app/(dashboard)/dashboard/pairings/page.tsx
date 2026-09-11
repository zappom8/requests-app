import { prisma } from "@/lib/prisma";
import SongPairingsManager from "./SongPairingsManager";

// Admin-facing, always needs current state — never statically cached.
export const dynamic = "force-dynamic";

export default async function SongPairingsPage() {
  const [songs, members] = await Promise.all([
    // Deduped across every database — the picker shouldn't show the same
    // song once per database it happens to be catalogued in.
    prisma.song.findMany({
      distinct: ["name", "artist"],
      orderBy: { name: "asc" },
      select: { name: true, artist: true },
    }),
    prisma.songPairingGroupMember.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  const groupsById = new Map<string, typeof members>();
  for (const m of members) {
    const group = groupsById.get(m.groupId);
    if (group) group.push(m);
    else groupsById.set(m.groupId, [m]);
  }
  const groups = [...groupsById.entries()].map(([groupId, groupMembers]) => ({
    groupId,
    members: groupMembers.map((m) => ({ id: m.id, songName: m.songName, artistName: m.artistName })),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold mb-1">Song Pairings</h1>
        <p className="text-sm text-foreground-muted">
          Group songs that transition into each other with no break — requesting any one auto-adds the rest to
          the Live Queue as linked songs, in either direction, and they never count in Statistics. Applies
          across every Song Database — the same group works wherever its songs are catalogued.
        </p>
      </div>

      <SongPairingsManager songs={songs} groups={groups} />
    </div>
  );
}
