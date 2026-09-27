// One-off loader for ForScoreProgram rows: the MIDI Program Change that
// opens each song's score in Lochie's "Footdrums" forScore set list
// (program = the song's position in that set list, channel 1). Matched to
// website songs by title; forScore songs with no website song (Somebody
// That I Used To Know, Super Rich Kids, Happy Birthday, Feel Good Inc.)
// are left out. Idempotent — upserts, so safe to re-run.
//
//   npx tsx prisma/seed-forscore-programs.ts
//   (against Supabase: set -a && source .env.supabase && set +a first)
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const PERFORMER_SLUG = "lochie";

const PROGRAMS: [program: number, songName: string, artistName: string][] = [
  [0, "Wish You Well", "Bernard Fanning"],
  [1, "I'm Gonna Be (500 Miles)", "The Proclaimers"],
  [2, "How You Remind Me", "Nickelback"],
  [3, "What About Me?", "Moving Pictures"],
  [4, "Perfect", "Ed Sheeran"],
  [5, "Yesterday", "The Beatles"],
  [6, "Love Story", "Taylor Swift"],
  [7, "Rolling in the Deep", "Adele"],
  [8, "Don't Stop", "Fleetwood Mac"],
  [9, "Brown Eyed Girl", "Van Morrison"],
  [10, "Watermelon Sugar", "Harry Styles"],
  [11, "Riptide", "Vance Joy"],
  [12, "Someone You Loved", "Lewis Capaldi"],
  [13, "Stay", "The Kid LAROI & Justin Bieber"],
  [14, "Shape of You", "Ed Sheeran"],
  [15, "Levitating", "Dua Lipa"],
  [16, "Blinding Lights", "The Weeknd"],
  [17, "Scar", "Missy Higgins"],
  [18, "Isn't She Lovely", "Stevie Wonder"],
  [19, "Go Your Own Way", "Fleetwood Mac"],
  [20, "Murder on the Dancefloor", "Sophie Ellis-Bextor"],
  [21, "Espresso", "Sabrina Carpenter"],
  [22, "Good Luck, Babe!", "Chappell Roan"],
  [23, "Don't Look Back In Anger", "Oasis"],
  [24, "Unwritten", "Natasha Bedingfield"],
  [25, "Iris", "The Goo Goo Dolls"],
  [26, "Valerie", "Amy Winehouse"],
  [27, "Take Me Home, Country Roads", "John Denver"],
  [28, "Thinking Out Loud", "Ed Sheeran"],
  [29, "Upside Down", "Jack Johnson"],
  [30, "Summer of '69", "Bryan Adams"],
  [31, "Never Tear Us Apart", "INXS"],
  [32, "I've Just Seen a Face", "The Beatles"],
  [33, "In the Summertime", "Thirsty Merc"],
  [34, "I Need a Dollar", "Aloe Blacc"],
  [35, "High and Dry", "Radiohead"],
  [36, "Boys Don't Cry", "The Cure"],
  [37, "Better Together", "Jack Johnson"],
  [38, "Banana Pancakes", "Jack Johnson"],
  [39, "Sex on Fire", "Kings of Leon"],
  [40, "Teenage Dirtbag", "Wheatus"],
  [41, "Yellow", "Coldplay"],
  [42, "Angels", "Robbie Williams"],
  [43, "Beautiful Crazy", "Luke Combs"],
  [44, "Have You Ever Seen the Rain", "Creedence Clearwater Revival"],
  [45, "My Happiness", "Powderfinger"],
  [46, "Stick Season", "Noah Kahan"],
  [47, "Linger", "The Cranberries"],
  [48, "Electric Feel", "MGMT"],
  [49, "Flame Trees", "Cold Chisel"],
  [50, "Get Lucky", "Daft Punk"],
  [51, "All of Me", "John Legend"],
  [52, "Chandelier", "Sia"],
  [53, "Better Be Home Soon", "Crowded House"],
  [54, "She's Electric", "Oasis"],
  [55, "April Sun In Cuba", "Dragon"],
  [56, "Bodyguard", "Beyoncé"],
  [57, "Someday", "The Strokes"],
  [58, "Lost", "Frank Ocean"],
  [59, "(I Can't Get No) Satisfaction", "The Rolling Stones"],
  [60, "Mr. Brightside", "The Killers"],
  [61, "Free Fallin'", "Tom Petty"],
  [62, "Don't Stop Believin'", "Journey"],
  [63, "Jolene", "Dolly Parton"],
  [64, "Seven Nation Army", "The White Stripes"],
  [65, "Shut Up and Dance", "WALK THE MOON"],
  [66, "(Sittin’ On) The Dock of the Bay", "Otis Redding"],
  [67, "Wagon Wheel", "Darius Rucker"],
  [68, "Zombie", "The Cranberries"],
  [69, "Wonderwall", "Oasis"],
  [70, "Uptown Girl", "Billy Joel"],
  [71, "Dreams", "Fleetwood Mac"],
  [72, "Come Together", "The Beatles"],
  [73, "The Best", "Tina Turner"],
  [74, "Hey Jude", "The Beatles"],
  [75, "Sk8er Boi", "Avril Lavigne"],
  [76, "All Day and All of the Night", "The Kinks"],
  [77, "Can't Buy Me Love", "The Beatles"],
  [78, "Castle on the Hill", "Ed Sheeran"],
  [79, "Build Me Up Buttercup", "The Foundations"],
  [80, "Sweet Caroline", "Neil Diamond"],
  [81, "I'm a Believer", "The Monkees"],
  [82, "I Love Rock 'n' Roll", "Joan Jett & the Blackhearts"],
  [83, "Don't Stop Me Now", "Queen"],
  [84, "Crazy Little Thing Called Love", "Queen"],
  [85, "Dancing Queen", "ABBA"],
  [86, "Man! I Feel Like a Woman!", "Shania Twain"],
  [87, "Pink Pony Club", "Chappell Roan"],
  [88, "The Gambler", "Kenny Rogers"],
  [89, "Baby I've Got You On My Mind", "Powderfinger"],
  [90, "Don't Dream It's Over", "Crowded House"],
  [91, "Roxanne", "The Police"],
  [93, "Good Riddance (Time of Your Life)", "Green Day"],
  [94, "Vienna", "Billy Joel"],
  [96, "Creep", "Radiohead"],
  [97, "Dirty Work", "Steely Dan"],
  [98, "Highway to Hell", "AC/DC"],
  [99, "I Want To Break Free", "Queen"],
  [100, "Tomorrow", "Silverchair"],
  [101, "All The Small Things", "Blink-182"],
  [103, "Dracula", "Tame Impala"],
  [104, "Man I Need", "Olivia Dean"],
  [105, "Nice To Each Other", "Olivia Dean"],
  [107, "Song 2", "Blur"],
  [108, "Am I Ever Gonna See Your Face Again", "The Angels"],
  [109, "Billie Jean", "Michael Jackson"],
  [110, "This Love", "Maroon 5"],
  [111, "Viva La Vida", "Coldplay"],
  [112, "12 to 12", "Sombr"],
  [113, "Where The Wild Things Are", "Luke Combs"],
  [114, "9 to 5", "Dolly Parton"],
  [115, "Rocket Man", "Elton John"],
  [116, "Cruel Summer", "Taylor Swift"],
  [117, "Human", "The Killers"],
  [118, "No One Noticed", "The Marias"],
  [119, "Bennie And The Jets", "Elton John"],
  [120, "Your Song", "Elton John"],
];

async function main() {
  const performer = await prisma.performer.findUniqueOrThrow({ where: { slug: PERFORMER_SLUG } });
  for (const [program, songName, artistName] of PROGRAMS) {
    await prisma.forScoreProgram.upsert({
      where: { performerId_songName_artistName: { performerId: performer.id, songName, artistName } },
      create: { performerId: performer.id, songName, artistName, program },
      update: { program },
    });
  }
  console.log(`Upserted ${PROGRAMS.length} program numbers for ${performer.name}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
