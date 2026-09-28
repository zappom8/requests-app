import { prisma } from "@/lib/prisma";
import { getCurrentPerformer } from "@/lib/auth";
import ForScoreControl from "./ForScoreControl";
import ForScoreLinksManager from "./ForScoreLinksManager";

// Admin-facing, always needs current state — never statically cached.
export const dynamic = "force-dynamic";

export default async function ForScorePage() {
  const performer = await getCurrentPerformer();
  const [songs, links] = await Promise.all([
    // Deduped across every database, same as the Keys page.
    prisma.song.findMany({
      where: { songDatabase: { performerId: performer.id } },
      distinct: ["name", "artist"],
      orderBy: { name: "asc" },
      select: { name: true, artist: true },
    }),
    prisma.forScoreLink.findMany({ where: { performerId: performer.id } }),
  ]);

  const linkByName = new Map(links.map((l) => [`${l.songName}::${l.artistName}`, l]));
  const rows = songs.map((s) => {
    const link = linkByName.get(`${s.name}::${s.artist}`);
    return {
      songName: s.name,
      artistName: s.artist,
      title: link?.title ?? null,
      setlist: link?.setlist ?? null,
    };
  });
  const linkedTitles = [...new Set(links.map((l) => l.title).filter((t): t is string => !!t))].sort();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold mb-1">forScore Remote</h1>
        <p className="text-sm text-foreground-muted">
          Open scores in forScore on your iPad or iPhone from the Live Queue, with no MIDI. The device running
          forScore runs the forScore Receiver shortcut; choose it in Settings.
        </p>
      </div>

      <ForScoreControl linkedTitles={linkedTitles} />

      <section className="space-y-3">
        <div>
          <h2 className="font-semibold">Song → forScore score</h2>
          <p className="text-sm text-foreground-muted">
            The exact title of each song&apos;s score in forScore (it doesn&apos;t have to match the song&apos;s name
            here). The setlist is optional — forScore then only looks in that setlist. Saved as you type. Songs with a
            title get the forScore button on the Live Queue.
          </p>
        </div>
        <ForScoreLinksManager rows={rows} />
      </section>
    </div>
  );
}
