import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateSongsCsv } from "@/lib/csv";
import { getSignedInPerformer } from "@/lib/auth";

// Signed-out requests are rejected by src/proxy.ts; scoped to the caller's performer below.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const performer = await getSignedInPerformer();
  if (!performer) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;

  const database = await prisma.songDatabase.findFirst({
    where: { id, performerId: performer.id },
    include: { songs: { orderBy: { name: "asc" } } },
  });
  if (!database) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const csv = generateSongsCsv(database.songs);
  const filename = `${database.name.replace(/[^a-z0-9]+/gi, "-")}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
