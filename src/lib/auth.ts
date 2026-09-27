import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSupabaseAuthServerClient } from "@/lib/supabase/server";
import type { Performer } from "@/generated/prisma/client";

// The performer the original, un-prefixed public URLs (/request, /queue,
// /profile, /gigs, /book, and the printed QR code) belong to.
export const DEFAULT_PERFORMER_SLUG = "lochie";

// The Performer linked to the current Supabase login, or null (signed out,
// or signed in with an account that has no Performer — e.g. someone who
// managed to sign up to the Supabase project directly). Cached per request.
// getClaims() verifies the JWT rather than trusting cookie contents.
export const getSignedInPerformer = cache(async (): Promise<Performer | null> => {
  const supabase = await getSupabaseAuthServerClient();
  const { data } = await supabase.auth.getClaims();
  const authUserId = data?.claims?.sub;
  if (!authUserId) return null;
  return prisma.performer.findUnique({ where: { authUserId } });
});

// For dashboard pages. src/proxy.ts already bounces signed-out visitors to
// the login page, so reaching the fallback here means signed in without a
// Performer — sent to a page that says so (not the login page, which the
// proxy would bounce straight back here, looping).
export async function getCurrentPerformer(): Promise<Performer> {
  const performer = await getSignedInPerformer();
  if (!performer) redirect("/dashboard/no-access");
  return performer;
}

// For Server Actions. Every dashboard action must call this first: Server
// Actions are reachable by direct POST, so src/proxy.ts's page-level check
// is not a security boundary for them.
export async function requirePerformer(): Promise<Performer> {
  const performer = await getSignedInPerformer();
  if (!performer) throw new Error("Not signed in.");
  return performer;
}

export const getDefaultPerformer = cache(async (): Promise<Performer> => {
  const performer = await prisma.performer.findUnique({ where: { slug: DEFAULT_PERFORMER_SLUG } });
  if (!performer) throw new Error(`Default performer "${DEFAULT_PERFORMER_SLUG}" is missing`);
  return performer;
});

// Ownership checks for ids that arrive from the client. Throw rather than
// silently no-op so a tampered id surfaces as an error.
export async function assertOwnsDatabase(performerId: string, songDatabaseId: string) {
  const count = await prisma.songDatabase.count({ where: { id: songDatabaseId, performerId } });
  if (count === 0) throw new Error("Song database not found.");
}

export async function assertOwnsDatabases(performerId: string, songDatabaseIds: string[]) {
  const unique = [...new Set(songDatabaseIds)];
  const count = await prisma.songDatabase.count({ where: { id: { in: unique }, performerId } });
  if (count !== unique.length) throw new Error("Song database not found.");
}

export async function assertOwnsVenue(performerId: string, venueId: string) {
  const count = await prisma.venue.count({ where: { id: venueId, performerId } });
  if (count === 0) throw new Error("Venue not found.");
}
