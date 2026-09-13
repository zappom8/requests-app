import { prisma } from "@/lib/prisma";
import KeysManager from "./KeysManager";

// Admin-facing, always needs current state — never statically cached.
export const dynamic = "force-dynamic";

export default async function KeysPage() {
  const [songs, keys] = await Promise.all([
    // Deduped across every database — the same physical song shouldn't
    // need its key entered once per database it happens to be catalogued in.
    prisma.song.findMany({
      distinct: ["name", "artist"],
      orderBy: { name: "asc" },
      select: { name: true, artist: true },
    }),
    prisma.songKey.findMany(),
  ]);

  const keyByName = new Map(keys.map((k) => [`${k.songName}::${k.artistName}`, k]));
  const rows = songs.map((s) => {
    const key = keyByName.get(`${s.name}::${s.artist}`);
    return {
      songName: s.name,
      artistName: s.artist,
      originalKey: key?.originalKey ?? null,
      lochiesKey: key?.lochiesKey ?? null,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold mb-1">Keys</h1>
        <p className="text-sm text-foreground-muted">
          The recording&apos;s original key, and the key you actually perform it in when it differs. Applies
          across every Song Database — fill a song&apos;s key in once here, wherever it&apos;s catalogued. Saved
          as you type, no submit button needed.
        </p>
      </div>

      <KeysManager rows={rows} />
    </div>
  );
}
