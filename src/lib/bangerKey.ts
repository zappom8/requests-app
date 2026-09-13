// Pure — no server-only imports — so both server code (building the set)
// and the client Live Queue component (looking a song up in it) can import
// this without pulling Prisma into the browser bundle.
export function bangerKey(songName: string, artistName: string): string {
  return `${songName}::${artistName}`;
}
