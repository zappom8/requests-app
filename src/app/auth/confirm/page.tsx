"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseAuthBrowserClient } from "@/lib/supabase/client";

// Landing point for invite/recovery emails. Supabase's recovery/invite links
// deliver the session as tokens in the URL *fragment*
// (#access_token=...&refresh_token=...) rather than a ?code= query param —
// fragments never reach the server, so this has to be handled client-side by
// reading window.location.hash and calling setSession() directly.
export default function AuthConfirmPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (!accessToken || !refreshToken) {
      router.replace("/dashboard/login?error=invalid_or_expired_link");
      return;
    }

    const supabase = getSupabaseAuthBrowserClient();
    supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(({ error: setError_ }) => {
      if (setError_) {
        setError(setError_.message);
        return;
      }
      router.replace("/dashboard/set-password");
    });
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 text-center">
      <p className="text-foreground-muted">{error ?? "Signing you in…"}</p>
    </div>
  );
}
