import { NextRequest, NextResponse } from "next/server";
import { searchSongs } from "@/lib/search";
import { prisma } from "@/lib/prisma";
import { getCancelledArtists } from "@/lib/cancelledArtists";

export async function GET(request: NextRequest) {
  const databaseId = request.nextUrl.searchParams.get("databaseId");
  const q = request.nextUrl.searchParams.get("q") ?? "";

  if (!databaseId) {
    return NextResponse.json({ error: "databaseId is required" }, { status: 400 });
  }

  const db = await prisma.songDatabase.findUnique({ where: { id: databaseId }, select: { performerId: true } });
  const cancelled = db ? await getCancelledArtists(db.performerId) : [];
  const results = await searchSongs(databaseId, q, 30, cancelled);
  return NextResponse.json({ results });
}
