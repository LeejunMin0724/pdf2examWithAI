"use client";

import { createBrowserClient } from "@supabase/ssr";
import { isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase-env";

/**
 * Browser Supabase client. Uses @supabase/ssr's browser client so the session
 * lives in cookies (not localStorage) — the recommended flow that keeps the
 * server and client in sync. Supabase manages refresh tokens automatically:
 * the user stays logged in across refreshes and browser restarts until the
 * session expires or they log out.
 */
export function createSupabaseBrowserClient() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase가 설정되어 있지 않습니다.");
  }
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
