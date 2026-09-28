// forScore's URL scheme, per https://forscore.co/developers-automation/:
//
//   forscore://open?path=<filename>&score=<title>&setlist=<name>&page=<n>
//
// "path" is the score's filename and wins over "score" (its title) when
// both are given. forScore tries an exact match, then case-insensitive,
// then case- and diacritics-insensitive; with no match it fails silently.
// Values are percent-encoded with encodeURIComponent (spaces as %20, as in
// forScore's own examples — URLSearchParams would write "+" instead).
// This is the only place the URL format lives.

export type ForScoreTarget = {
  title?: string | null;
  filename?: string | null;
  setlist?: string | null;
  page?: number | null;
};

export function buildForScoreOpenUrl(target: ForScoreTarget): string {
  const params: [string, string][] = [];
  if (target.filename) params.push(["path", target.filename]);
  if (target.title) params.push(["score", target.title]);
  if (target.setlist) params.push(["setlist", target.setlist]);
  if (target.page) params.push(["page", String(target.page)]);
  const query = params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
  return `forscore://open?${query}`;
}
