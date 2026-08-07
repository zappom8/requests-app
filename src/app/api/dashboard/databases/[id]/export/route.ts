import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateSongsCsv } from "@/lib/csv";

// Auth enforced by src/proxy.ts (matches /api/dashboard/:path*).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const database = await prisma.songDatabase.findUnique({
    where: { id },
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
