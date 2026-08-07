import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const SAMPLE_SONGS: { name: string; artist: string; decade: string }[] = [
  { name: "Dreams", artist: "Fleetwood Mac", decade: "1970s" },
  { name: "Valerie", artist: "Amy Winehouse", decade: "2000s" },
  { name: "Mr Brightside", artist: "The Killers", decade: "2000s" },
  { name: "Wonderwall", artist: "Oasis", decade: "1990s" },
  { name: "Superstition", artist: "Stevie Wonder", decade: "1970s" },
  { name: "Billie Jean", artist: "Michael Jackson", decade: "1980s" },
  { name: "Torn", artist: "Natalie Imbruglia", decade: "1990s" },
  { name: "Uptown Funk", artist: "Mark Ronson ft. Bruno Mars", decade: "2010s" },
  { name: "Sweet Caroline", artist: "Neil Diamond", decade: "1960s" },
  { name: "Ain't No Mountain High Enough", artist: "Marvin Gaye & Tammi Terrell", decade: "1960s" },
];

async function main() {
  const database = await prisma.songDatabase.upsert({
    where: { id: "general-requests" },
    update: {},
    create: { id: "general-requests", name: "General Requests" },
  });

  for (const song of SAMPLE_SONGS) {
    const existing = await prisma.song.findFirst({
      where: { songDatabaseId: database.id, name: song.name, artist: song.artist },
    });
    if (!existing) {
      await prisma.song.create({ data: { ...song, songDatabaseId: database.id } });
    }
  }

  await prisma.settings.upsert({
    where: { id: 1 },
    update: { activeSongDatabaseId: database.id },
    create: { id: 1, activeSongDatabaseId: database.id },
  });

  console.log(`Seeded "${database.name}" with ${SAMPLE_SONGS.length} songs and set it active.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
