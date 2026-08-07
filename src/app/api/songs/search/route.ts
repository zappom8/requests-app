import { NextRequest, NextResponse } from "next/server";
import { searchSongs } from "@/lib/search";

export async function GET(request: NextRequest) {
  const databaseId = request.nextUrl.searchParams.get("databaseId");
  const q = request.nextUrl.searchParams.get("q") ?? "";

  if (!databaseId) {
    return NextResponse.json({ error: "databaseId is required" }, { status: 400 });
  }

  const results = await searchSongs(databaseId, q);
  return NextResponse.json({ results });
}
