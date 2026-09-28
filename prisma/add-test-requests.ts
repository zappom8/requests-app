// Queues N random songs (default 20) from Lochie's active song database as
// requests from "Test", for trying out the Live Queue (e.g. the forScore
// button). Requester "Test" keeps them out of Request History and
// Statistics (see REAL_REQUESTS_ONLY in src/lib/statistics.ts). Only songs
// with a forScore title are picked. Clear them afterwards with Played/Delete
// on the Live Queue.
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

  const [songs, links] = await Promise.all([
    prisma.song.findMany({ where: { songDatabaseId } }),
    prisma.forScoreLink.findMany({ where: { performerId: performer.id, title: { not: null } } }),
  ]);
  const linked = new Set(links.map((l) => `${l.songName}::${l.artistName}`));
  const candidates = songs.filter((s) => linked.has(`${s.name}::${s.artist}`));
  const picked = candidates.sort(() => Math.random() - 0.5).slice(0, count);

  const start = Date.now();
  for (const [i, song] of picked.entries()) {
    await prisma.request.create({
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
  }
  console.log(`Queued ${picked.length} test requests:\n${picked.map((s) => `  ${s.name} — ${s.artist}`).join("\n")}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
