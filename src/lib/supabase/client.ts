import { createClient } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/ssr";

// Browser client — publishable key only, safe to expose. Used for
// subscribing to Realtime Broadcast channels (e.g. "queue changed").
export function getSupabaseBrowserClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}

// Cookie-aware browser client (@supabase/ssr) — used only for the dashboard
// login form (signInWithPassword / signOut), so the session cookie the
// server reads is set correctly.
export function getSupabaseAuthBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
