import { prisma } from "@/lib/prisma";
import { getDefaultPerformer } from "@/lib/auth";
import MidiTestClient from "./MidiTestClient";

// Always reads the current program numbers — never statically cached.
export const dynamic = "force-dynamic";

export default async function MidiTestPage() {
  const performer = await getDefaultPerformer();
  const songs = await prisma.forScoreProgram.findMany({
    where: { performerId: performer.id },
    orderBy: { program: "asc" },
    select: { songName: true, artistName: true, program: true },
  });

  return <MidiTestClient songs={songs} />;
}
