// Queues N random songs (default 20) from Lochie's active song database as
// requests from "Test", for trying out the Live Queue (e.g. the forScore
// button). Requester "Test" keeps them out of Request History and
// Statistics (see REAL_REQUESTS_ONLY in src/lib/statistics.ts). Only songs
// with a forScore title are picked, about half of them from song pairings,
// and each paired pick also queues the rest of its group (as linked songs,
// like a real request does) — for trying L on the Live Queue. Clear them
// afterwards with Played/Delete on the Live Queue.
//
//   npx tsx prisma/add-test-requests.ts [count]
//   (against Supabase: set -a && source .env.supabase && set +a first)
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const PERFORMER_SLUG = "lochie";
const count = Number(process.argv[2] ?? 20);

async function main() {
  const performer = await prisma.performer.findUniqueOrThrow({
    where: { slug: PERFORMER_SLUG },
    include: { settings: true },
  });
  const songDatabaseId = performer.settings?.activeSongDatabaseId;
  if (!songDatabaseId) throw new Error("No active song database.");

  const [songs, links, pairings] = await Promise.all([
    prisma.song.findMany({ where: { songDatabaseId } }),
    prisma.forScoreLink.findMany({ where: { performerId: performer.id, title: { not: null } } }),
    prisma.songPairingGroupMember.findMany({ where: { performerId: performer.id } }),
  ]);
  const keyOf = (name: string, artist: string) => `${name}::${artist}`;
  const linked = new Set(links.map((l) => keyOf(l.songName, l.artistName)));
  const songByKey = new Map(songs.map((s) => [keyOf(s.name, s.artist), s]));
  const groupOf = new Map(pairings.map((m) => [keyOf(m.songName, m.artistName), m.groupId]));
  const candidates = songs.filter((s) => linked.has(keyOf(s.name, s.artist))).sort(() => Math.random() - 0.5);

  // Half from pairings (one song per group, so groups don't overlap), the
  // rest unpaired.
  const usedGroups = new Set<string>();
  const paired = candidates.filter((s) => {
    const g = groupOf.get(keyOf(s.name, s.artist));
    if (!g || usedGroups.has(g)) return false;
    usedGroups.add(g);
    return true;
  });
  const pairedPicks = paired.slice(0, Math.ceil(count / 2));
  const unpaired = candidates.filter((s) => !groupOf.has(keyOf(s.name, s.artist)));
  const picked = [...pairedPicks, ...unpaired.slice(0, count - pairedPicks.length)].sort(() => Math.random() - 0.5);

  const start = Date.now();
  const lines: string[] = [];
  for (const [i, song] of picked.entries()) {
    const request = await prisma.request.create({
      data: {
        songDatabaseId,
        songId: song.id,
        songName: song.name,
        artistName: song.artist,
        decade: song.decade,
        requesterName: "Test",
        // Spaced a second apart so they queue in this order.
        requestedAt: new Date(start + i * 1000),
      },
    });
    const groupId = groupOf.get(keyOf(song.name, song.artist));
    const others = groupId
      ? pairings
          .filter((m) => m.groupId === groupId && keyOf(m.songName, m.artistName) !== keyOf(song.name, song.artist))
          .map((m) => songByKey.get(keyOf(m.songName, m.artistName)))
          .filter((s) => s !== undefined)
      : [];
    if (others.length > 0) {
      await prisma.request.createMany({
        data: others.map((o) => ({
          songDatabaseId,
          songId: o.id,
          songName: o.name,
          artistName: o.artist,
          decade: o.decade,
          requesterName: "Test",
          isPairedAddition: true,
          triggeredByRequestId: request.id,
        })),
      });
    }
    lines.push(`  ${song.name} — ${song.artist}${others.length ? `  (+ ${others.map((o) => o.name).join(", ")})` : ""}`);
  }
  console.log(`Queued ${picked.length} test requests:\n${lines.join("\n")}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
