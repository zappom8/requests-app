// One-off loader for ForScoreLink titles: the exact forScore title of each
// song's score in Lochie's real "Footdrums" library, so the Live Queue's
// forScore button can open it by title on his iPhone/iPad
// (forscore://open?score=). Taken from the Footdrums .4ss export by
// set-list position, which is also each song's ForScoreProgram number (see
// seed-forscore-programs.ts). The "Footdrums (Test)" copies on the iPad have
// the same titles plus a " (Test)" suffix. Only the
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
  ["Wish You Well", "Bernard Fanning", "Wish You Well"],
  ["I'm Gonna Be (500 Miles)", "The Proclaimers", "I'm Gonna Be (500 Miles)"],
  ["How You Remind Me", "Nickelback", "How You Remind Me"],
  ["What About Me?", "Moving Pictures", "What About Me?"],
  ["Perfect", "Ed Sheeran", "Perfect"],
  ["Yesterday", "The Beatles", "Yesterday"],
  ["Love Story", "Taylor Swift", "Love Story"],
  ["Rolling in the Deep", "Adele", "Rolling in the Deep"],
  ["Don't Stop", "Fleetwood Mac", "Don't Stop"],
  ["Brown Eyed Girl", "Van Morrison", "Brown Eyed Girl"],
  ["Watermelon Sugar", "Harry Styles", "Watermelon Sugar"],
  ["Riptide", "Vance Joy", "Riptide"],
  ["Someone You Loved", "Lewis Capaldi", "Someone You Loved"],
  ["Stay", "The Kid LAROI & Justin Bieber", "Stay"],
  ["Shape of You", "Ed Sheeran", "Shape Of You"],
  ["Levitating", "Dua Lipa", "Levitating"],
  ["Blinding Lights", "The Weeknd", "Blinding Lights"],
  ["Scar", "Missy Higgins", "Scar"],
  ["Isn't She Lovely", "Stevie Wonder", "Isn't She Lovely"],
  ["Go Your Own Way", "Fleetwood Mac", "Go Your Own Way"],
  ["Murder on the Dancefloor", "Sophie Ellis-Bextor", "Murder on the Dancefloor"],
  ["Espresso", "Sabrina Carpenter", "Espresso"],
  ["Good Luck, Babe!", "Chappell Roan", "Good Luck Babe"],
  ["Don't Look Back In Anger", "Oasis", "Don't Look Back In Anger"],
  ["Unwritten", "Natasha Bedingfield", "Unwritten"],
  ["Iris", "The Goo Goo Dolls", "Iris"],
  ["Valerie", "Amy Winehouse", "Valerie"],
  ["Take Me Home, Country Roads", "John Denver", "Take Me Home, Country Roads"],
  ["Thinking Out Loud", "Ed Sheeran", "Thinking Out Loud"],
  ["Upside Down", "Jack Johnson", "Upside Down"],
  ["Summer of '69", "Bryan Adams", "Summer of 69"],
  ["Never Tear Us Apart", "INXS", "Never Tear Us Apart"],
  ["I've Just Seen a Face", "The Beatles", "I've Just Seen A Face"],
  ["In the Summertime", "Thirsty Merc", "In The Summertime"],
  ["I Need a Dollar", "Aloe Blacc", "I Need A Dollar"],
  ["High and Dry", "Radiohead", "High And Dry"],
  ["Boys Don't Cry", "The Cure", "Boys Don't Cry"],
  ["Better Together", "Jack Johnson", "Better Together"],
  ["Banana Pancakes", "Jack Johnson", "Banana Pancakes"],
  ["Sex on Fire", "Kings of Leon", "Sex on Fire"],
  ["Teenage Dirtbag", "Wheatus", "Teenage Dirtbag"],
  ["Yellow", "Coldplay", "Yellow"],
  ["Angels", "Robbie Williams", "Angels"],
  ["Beautiful Crazy", "Luke Combs", "Beautiful Crazy"],
  ["Have You Ever Seen the Rain", "Creedence Clearwater Revival", "Have You Ever Seen The Rain"],
  ["My Happiness", "Powderfinger", "My Happiness"],
  ["Stick Season", "Noah Kahan", "Stick Season"],
  ["Linger", "The Cranberries", "Linger"],
  ["Electric Feel", "MGMT", "Electric Feel"],
  ["Flame Trees", "Cold Chisel", "Flame Trees"],
  ["Get Lucky", "Daft Punk", "Get Lucky"],
  ["All of Me", "John Legend", "All of Me"],
  ["Chandelier", "Sia", "Chandelier"],
  ["Better Be Home Soon", "Crowded House", "Better Be Home Soon"],
  ["She's Electric", "Oasis", "She's Electric"],
  ["April Sun In Cuba", "Dragon", "April Sun In Cuba"],
  ["Bodyguard", "Beyoncé", "Bodyguard"],
  ["Someday", "The Strokes", "Someday"],
  ["Lost", "Frank Ocean", "Lost"],
  ["(I Can't Get No) Satisfaction", "The Rolling Stones", "Satisfaction"],
  ["Mr. Brightside", "The Killers", "Mr. Brightside"],
  ["Free Fallin'", "Tom Petty", "Free Fallin'"],
  ["Don't Stop Believin'", "Journey", "Don't Stop Believin'"],
  ["Jolene", "Dolly Parton", "Jolene"],
  ["Seven Nation Army", "The White Stripes", "Seven Nation Army"],
  ["Shut Up and Dance", "WALK THE MOON", "Shut Up and Dance"],
  ["(Sittin’ On) The Dock of the Bay", "Otis Redding", "Sittin’ On The Dock of the Bay"],
  ["Wagon Wheel", "Darius Rucker", "Wagon Wheel"],
  ["Zombie", "The Cranberries", "Zombie"],
  ["Wonderwall", "Oasis", "Wonderwall"],
  ["Uptown Girl", "Billy Joel", "Uptown Girl"],
  ["Dreams", "Fleetwood Mac", "Dreams"],
  ["Come Together", "The Beatles", "Come Together"],
  ["The Best", "Tina Turner", "The Best"],
  ["Hey Jude", "The Beatles", "Hey Jude"],
  ["Sk8er Boi", "Avril Lavigne", "Sk8er Boi"],
  ["All Day and All of the Night", "The Kinks", "All Day and All of the Night"],
  ["Can't Buy Me Love", "The Beatles", "Can't Buy Me Love"],
  ["Castle on the Hill", "Ed Sheeran", "Castle on the Hill"],
  ["Build Me Up Buttercup", "The Foundations", "Build Me Up Buttercup"],
  ["Sweet Caroline", "Neil Diamond", "Sweet Caroline"],
  ["I'm a Believer", "The Monkees", "I'm A Believer"],
  ["I Love Rock 'n' Roll", "Joan Jett & the Blackhearts", "I Love Rock n Roll"],
  ["Don't Stop Me Now", "Queen", "Don't Stop Me Now"],
  ["Crazy Little Thing Called Love", "Queen", "Crazy Little Thing Called Love"],
  ["Dancing Queen", "ABBA", "Dancing Queen"],
  ["Man! I Feel Like a Woman!", "Shania Twain", "Man! I Feel Like A Woman!"],
  ["Pink Pony Club", "Chappell Roan", "Pink Pony Club"],
  ["The Gambler", "Kenny Rogers", "The Gambler"],
  ["Baby I've Got You On My Mind", "Powderfinger", "Baby Ive Got You On My Mind"],
  ["Don't Dream It's Over", "Crowded House", "Don’t Dream Its Over"],
  ["Roxanne", "The Police", "Roxanne"],
  ["Good Riddance (Time of Your Life)", "Green Day", "Good Riddance (Time Of Your Life)"],
  ["Vienna", "Billy Joel", "Vienna"],
  ["Creep", "Radiohead", "Creep"],
  ["Dirty Work", "Steely Dan", "Dirty Work"],
  ["Highway to Hell", "AC/DC", "Highway To Hell"],
  ["I Want To Break Free", "Queen", "I Want To Break Free"],
  ["Tomorrow", "Silverchair", "Tomorrow"],
  ["All The Small Things", "Blink-182", "All The Small Things"],
  ["Dracula", "Tame Impala", "Dracula"],
  ["Man I Need", "Olivia Dean", "Man I Need"],
  ["Nice To Each Other", "Olivia Dean", "Nice To Each Other"],
  ["Song 2", "Blur", "Song 2"],
  ["Am I Ever Gonna See Your Face Again", "The Angels", "Am I Ever Gonna See Your Face Again"],
  ["Billie Jean", "Michael Jackson", "Billie Jean"],
  ["This Love", "Maroon 5", "This Love"],
  ["Viva La Vida", "Coldplay", "Viva La Vida"],
  ["12 to 12", "Sombr", "12 To 12"],
  ["Where The Wild Things Are", "Luke Combs", "Where The Wild Things Are"],
  ["9 to 5", "Dolly Parton", "9 To 5"],
  ["Rocket Man", "Elton John", "Rocket Man"],
  ["Cruel Summer", "Taylor Swift", "Cruel Summer"],
  ["Human", "The Killers", "Human"],
  ["No One Noticed", "The Marias", "No One Noticed"],
  ["Bennie And The Jets", "Elton John", "Bennie and the Jets"],
  ["Your Song", "Elton John", "Your Song"],
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
