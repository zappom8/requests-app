// One-off loader for ForScoreLink titles: the exact forScore title of each
// song's score in Lochie's "Footdrums (Test)" set list, so the Live Queue's
// forScore button can open it by title on the iPad (forscore://open?score=).
// Taken from that .4ss export by set-list position, which is also each
// song's ForScoreProgram number (see seed-forscore-programs.ts). Only the
// title is written — setlist/filename are left alone. Idempotent, safe to
// re-run.
//
//   npx tsx prisma/seed-forscore-links.ts
//   (against Supabase: set -a && source .env.supabase && set +a first)
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const PERFORMER_SLUG = "lochie";

const TITLES: [songName: string, artistName: string, forScoreTitle: string][] = [
  ["Wish You Well", "Bernard Fanning", "Wish You Well (Test)"],
  ["I'm Gonna Be (500 Miles)", "The Proclaimers", "I'm Gonna Be (500 Miles) (Test)"],
  ["How You Remind Me", "Nickelback", "How You Remind Me (Test)"],
  ["What About Me?", "Moving Pictures", "What About Me? (Test)"],
  ["Perfect", "Ed Sheeran", "Perfect (Test)"],
  ["Yesterday", "The Beatles", "Yesterday (Test)"],
  ["Love Story", "Taylor Swift", "Love Story (Test)"],
  ["Rolling in the Deep", "Adele", "Rolling in the Deep (Test)"],
  ["Don't Stop", "Fleetwood Mac", "Don't Stop (Test)"],
  ["Brown Eyed Girl", "Van Morrison", "Brown Eyed Girl (Test)"],
  ["Watermelon Sugar", "Harry Styles", "Watermelon Sugar (Test)"],
  ["Riptide", "Vance Joy", "Riptide (Test)"],
  ["Someone You Loved", "Lewis Capaldi", "Someone You Loved (Test)"],
  ["Stay", "The Kid LAROI & Justin Bieber", "Stay (Test)"],
  ["Shape of You", "Ed Sheeran", "Shape Of You (Test)"],
  ["Levitating", "Dua Lipa", "Levitating (Test)"],
  ["Blinding Lights", "The Weeknd", "Blinding Lights (Test)"],
  ["Scar", "Missy Higgins", "Scar (Test)"],
  ["Isn't She Lovely", "Stevie Wonder", "Isn't She Lovely (Test)"],
  ["Go Your Own Way", "Fleetwood Mac", "Go Your Own Way (Test)"],
  ["Murder on the Dancefloor", "Sophie Ellis-Bextor", "Murder on the Dancefloor (Test)"],
  ["Espresso", "Sabrina Carpenter", "Espresso (Test)"],
  ["Good Luck, Babe!", "Chappell Roan", "Good Luck Babe (Test)"],
  ["Don't Look Back In Anger", "Oasis", "Don't Look Back In Anger (Test)"],
  ["Unwritten", "Natasha Bedingfield", "Unwritten (Test)"],
  ["Iris", "The Goo Goo Dolls", "Iris (Test)"],
  ["Valerie", "Amy Winehouse", "Valerie (Test)"],
  ["Take Me Home, Country Roads", "John Denver", "Take Me Home, Country Roads (Test)"],
  ["Thinking Out Loud", "Ed Sheeran", "Thinking Out Loud (Test)"],
  ["Upside Down", "Jack Johnson", "Upside Down (Test)"],
  ["Summer of '69", "Bryan Adams", "Summer of 69 (Test)"],
  ["Never Tear Us Apart", "INXS", "Never Tear Us Apart (Test)"],
  ["I've Just Seen a Face", "The Beatles", "I've Just Seen A Face (Test)"],
  ["In the Summertime", "Thirsty Merc", "In The Summertime (Test)"],
  ["I Need a Dollar", "Aloe Blacc", "I Need A Dollar (Test)"],
  ["High and Dry", "Radiohead", "High And Dry (Test)"],
  ["Boys Don't Cry", "The Cure", "Boys Don't Cry (Test)"],
  ["Better Together", "Jack Johnson", "Better Together (Test)"],
  ["Banana Pancakes", "Jack Johnson", "Banana Pancakes (Test)"],
  ["Sex on Fire", "Kings of Leon", "Sex on Fire (Test)"],
  ["Teenage Dirtbag", "Wheatus", "Teenage Dirtbag (Test)"],
  ["Yellow", "Coldplay", "Yellow (Test)"],
  ["Angels", "Robbie Williams", "Angels (Test)"],
  ["Beautiful Crazy", "Luke Combs", "Beautiful Crazy (Test)"],
  ["Have You Ever Seen the Rain", "Creedence Clearwater Revival", "Have You Ever Seen The Rain (Test)"],
  ["My Happiness", "Powderfinger", "My Happiness (Test)"],
  ["Stick Season", "Noah Kahan", "Stick Season (Test)"],
  ["Linger", "The Cranberries", "Linger (Test)"],
  ["Electric Feel", "MGMT", "Electric Feel (Test)"],
  ["Flame Trees", "Cold Chisel", "Flame Trees (Test)"],
  ["Get Lucky", "Daft Punk", "Get Lucky (Test)"],
  ["All of Me", "John Legend", "All of Me (Test)"],
  ["Chandelier", "Sia", "Chandelier (Test)"],
  ["Better Be Home Soon", "Crowded House", "Better Be Home Soon (Test)"],
  ["She's Electric", "Oasis", "She's Electric (Test)"],
  ["April Sun In Cuba", "Dragon", "April Sun In Cuba (Test)"],
  ["Bodyguard", "Beyoncé", "Bodyguard (Test)"],
  ["Someday", "The Strokes", "Someday (Test)"],
  ["Lost", "Frank Ocean", "Lost (Test)"],
  ["(I Can't Get No) Satisfaction", "The Rolling Stones", "Satisfaction (Test)"],
  ["Mr. Brightside", "The Killers", "Mr. Brightside (Test)"],
  ["Free Fallin'", "Tom Petty", "Free Fallin' (Test)"],
  ["Don't Stop Believin'", "Journey", "Don't Stop Believin' (Test)"],
  ["Jolene", "Dolly Parton", "Jolene (Test)"],
  ["Seven Nation Army", "The White Stripes", "Seven Nation Army (Test)"],
  ["Shut Up and Dance", "WALK THE MOON", "Shut Up and Dance (Test)"],
  ["(Sittin’ On) The Dock of the Bay", "Otis Redding", "Sittin’ On The Dock of the Bay (Test)"],
  ["Wagon Wheel", "Darius Rucker", "Wagon Wheel (Test)"],
  ["Zombie", "The Cranberries", "Zombie (Test)"],
  ["Wonderwall", "Oasis", "Wonderwall (Test)"],
  ["Uptown Girl", "Billy Joel", "Uptown Girl (Test)"],
  ["Dreams", "Fleetwood Mac", "Dreams (Test)"],
  ["Come Together", "The Beatles", "Come Together (Test)"],
  ["The Best", "Tina Turner", "The Best (Test)"],
  ["Hey Jude", "The Beatles", "Hey Jude (Test)"],
  ["Sk8er Boi", "Avril Lavigne", "Sk8er Boi (Test)"],
  ["All Day and All of the Night", "The Kinks", "All Day and All of the Night (Test)"],
  ["Can't Buy Me Love", "The Beatles", "Can't Buy Me Love (Test)"],
  ["Castle on the Hill", "Ed Sheeran", "Castle on the Hill (Test)"],
  ["Build Me Up Buttercup", "The Foundations", "Build Me Up Buttercup (Test)"],
  ["Sweet Caroline", "Neil Diamond", "Sweet Caroline (Test)"],
  ["I'm a Believer", "The Monkees", "I'm A Believer (Test)"],
  ["I Love Rock 'n' Roll", "Joan Jett & the Blackhearts", "I Love Rock n Roll (Test)"],
  ["Don't Stop Me Now", "Queen", "Don't Stop Me Now (Test)"],
  ["Crazy Little Thing Called Love", "Queen", "Crazy Little Thing Called Love (Test)"],
  ["Dancing Queen", "ABBA", "Dancing Queen (Test)"],
  ["Man! I Feel Like a Woman!", "Shania Twain", "Man! I Feel Like A Woman! (Test)"],
  ["Pink Pony Club", "Chappell Roan", "Pink Pony Club (Test)"],
  ["The Gambler", "Kenny Rogers", "The Gambler (Test)"],
  ["Baby I've Got You On My Mind", "Powderfinger", "Baby Ive Got You On My Mind (Test)"],
  ["Don't Dream It's Over", "Crowded House", "Don’t Dream Its Over (Test)"],
  ["Roxanne", "The Police", "Roxanne (Test)"],
  ["Good Riddance (Time of Your Life)", "Green Day", "Good Riddance (Time Of Your Life) (Test)"],
  ["Vienna", "Billy Joel", "Vienna (Test)"],
  ["Creep", "Radiohead", "Creep (Test)"],
  ["Dirty Work", "Steely Dan", "Dirty Work (Test)"],
  ["Highway to Hell", "AC/DC", "Highway To Hell (Test)"],
  ["I Want To Break Free", "Queen", "I Want To Break Free (Test)"],
  ["Tomorrow", "Silverchair", "Tomorrow (Test)"],
  ["All The Small Things", "Blink-182", "All The Small Things (Test)"],
  ["Dracula", "Tame Impala", "Dracula (Test)"],
  ["Man I Need", "Olivia Dean", "Man I Need (Test)"],
  ["Nice To Each Other", "Olivia Dean", "Nice To Each Other (Test)"],
  ["Song 2", "Blur", "Song 2 (Test)"],
  ["Am I Ever Gonna See Your Face Again", "The Angels", "Am I Ever Gonna See Your Face Again (Test)"],
  ["Billie Jean", "Michael Jackson", "Billie Jean (Test)"],
  ["This Love", "Maroon 5", "This Love (Test)"],
  ["Viva La Vida", "Coldplay", "Viva La Vida (Test)"],
  ["12 to 12", "Sombr", "12 To 12 (Test)"],
  ["Where The Wild Things Are", "Luke Combs", "Where The Wild Things Are (Test)"],
  ["9 to 5", "Dolly Parton", "9 To 5 (Test)"],
  ["Rocket Man", "Elton John", "Rocket Man (Test)"],
  ["Cruel Summer", "Taylor Swift", "Cruel Summer (Test)"],
  ["Human", "The Killers", "Human (Test)"],
  ["No One Noticed", "The Marias", "No One Noticed (Test)"],
  ["Bennie And The Jets", "Elton John", "Bennie and the Jets (Test)"],
  ["Your Song", "Elton John", "Your Song (Test)"],
];

async function main() {
  const performer = await prisma.performer.findUniqueOrThrow({ where: { slug: PERFORMER_SLUG } });
  for (const [songName, artistName, title] of TITLES) {
    await prisma.forScoreLink.upsert({
      where: { performerId_songName_artistName: { performerId: performer.id, songName, artistName } },
      create: { performerId: performer.id, songName, artistName, title },
      update: { title },
    });
  }
  console.log(`Linked ${TITLES.length} songs to their forScore titles.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
