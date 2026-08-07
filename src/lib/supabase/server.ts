import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server-side client — secret key, never exposed to the browser. Used to
// send Realtime Broadcast messages after a mutation.
function getSupabaseServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  );
}

// Cookie-aware server client (@supabase/ssr) — reads/refreshes the admin's
// session from request cookies. Use getClaims() (not getSession()) to check
// auth, since only getClaims() verifies the JWT rather than trusting
// unverified cookie contents.
export async function getSupabaseAuthServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component render — cookies() is read-only there.
            // The proxy (src/proxy.ts) is what actually persists refreshed sessions.
          }
        },
      },
    }
  );
}

// Admin client — secret key, full auth admin access (inviteUserByEmail etc).
// Only ever used server-side, for one-off account provisioning.
export function getSupabaseAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function queueChannelName(songDatabaseId: string) {
  return `queue:${songDatabaseId}`;
}

// Sends a minimal "something changed" ping only — never queue contents.
// Clients that receive it refetch through /api/queue, which enforces the
// public-safe field selection. Keeps private data (requester name, shout-out,
// tip amount) out of the Realtime payload entirely.
export async function broadcastQueueChanged(songDatabaseId: string) {
  const supabase = getSupabaseServerClient();
  const channel = supabase.channel(queueChannelName(songDatabaseId));
  await channel.send({ type: "broadcast", event: "queue-changed", payload: {} });
}

export { queueChannelName };
