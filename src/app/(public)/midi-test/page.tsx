import { prisma } from "@/lib/prisma";
import MidiTestClient from "./MidiTestClient";

// Always reads the current program numbers — never statically cached.
export const dynamic = "force-dynamic";

export default async function MidiTestPage() {
  const songs = await prisma.forScoreProgram.findMany({
    where: { library: "Footdrums" },
    orderBy: { program: "asc" },
    select: { songName: true, artistName: true, program: true },
  });

  return <MidiTestClient songs={songs} />;
}
