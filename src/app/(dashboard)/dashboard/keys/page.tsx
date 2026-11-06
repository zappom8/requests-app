import { prisma } from "@/lib/prisma";
import { getCurrentPerformer } from "@/lib/auth";
import KeysManager from "./KeysManager";

// Admin-facing, always needs current state — never statically cached.
export const dynamic = "force-dynamic";

export default async function KeysPage() {
  const performer = await getCurrentPerformer();
  const [songs, keys] = await Promise.all([
    // Deduped across every database — the same physical song shouldn't
    // need its key entered once per database it happens to be catalogued in.
    prisma.song.findMany({
      where: { songDatabase: { performerId: performer.id } },
      distinct: ["name", "artist"],
      orderBy: { name: "asc" },
      select: { name: true, artist: true },
    }),
    prisma.songKey.findMany({ where: { performerId: performer.id } }),
  ]);

  const buildRows = (instrument: string) => {
    const keyByName = new Map(
      keys.filter((k) => k.instrument === instrument).map((k) => [`${k.songName}::${k.artistName}`, k]),
    );
    return songs.map((s) => {
    const key = keyByName.get(`${s.name}::${s.artist}`);
    return {
      songName: s.name,
      artistName: s.artist,
      originalKey: key?.originalKey ?? null,
      lochiesKey: key?.lochiesKey ?? null,
      startChord: key?.startChord ?? null,
      endChord: key?.endChord ?? null,
      capo: key?.capo ?? null,
    };
    });
  };
  const guitarRows = buildRows("guitar");
  const pianoRows = buildRows("piano");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold mb-1">Keys</h1>
        <p className="text-sm text-foreground-muted">
          The recording&apos;s original key, the key you actually perform it in when it differs, and the chord the
          song starts on and ends on (handy for planning transitions). Applies
          across every Song Database — fill a song&apos;s key in once here, wherever it&apos;s catalogued. Keys are kept separately for Guitar and Piano, and Guitar also has a capo fret. Saved
          as you type, no submit button needed.
        </p>
      </div>

      <KeysManager guitarRows={guitarRows} pianoRows={pianoRows} />
    </div>
  );
}
