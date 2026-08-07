"use server";

import { getSupabaseAuthServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function signOut() {
  const supabase = await getSupabaseAuthServerClient();
  await supabase.auth.signOut();
  redirect("/dashboard/login");
}
