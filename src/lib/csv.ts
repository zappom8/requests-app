import Papa from "papaparse";

export type ParsedSong = {
  name: string;
  artist: string;
  decade: string | null;
  originalKey: string | null;
  lochiesKey: string | null;
};

// Format: Song Name,Artist,Decade,Original Key,Lochie's Key — header row is
// optional and auto-detected. The two key columns are optional even with a
// header present (older CSVs, or ones without key data, just leave them
// blank/absent).
export function parseSongsCsv(text: string): ParsedSong[] {
  const result = Papa.parse<string[]>(text, { skipEmptyLines: true });
  const rows = result.data;
  if (rows.length === 0) return [];

  const looksLikeHeader =
    /^song\s*name$|^song$/i.test((rows[0][0] ?? "").trim()) && /^artist$/i.test((rows[0][1] ?? "").trim());
  const dataRows = looksLikeHeader ? rows.slice(1) : rows;

  return dataRows
    .map((row) => ({
      name: (row[0] ?? "").trim(),
      artist: (row[1] ?? "").trim(),
      decade: (row[2] ?? "").trim() || null,
      originalKey: (row[3] ?? "").trim() || null,
      lochiesKey: (row[4] ?? "").trim() || null,
    }))
    .filter((song) => song.name && song.artist);
}

export function generateSongsCsv(songs: ParsedSong[]): string {
  return Papa.unparse({
    fields: ["Song Name", "Artist", "Decade", "Original Key", "Lochie's Key"],
    data: songs.map((s) => [s.name, s.artist, s.decade ?? "", s.originalKey ?? "", s.lochiesKey ?? ""]),
  });
}
