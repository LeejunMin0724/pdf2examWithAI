import { createServerClient } from "@supabase/ssr";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase-env";

/**
 * Short HMAC token proving "this browser held anonymous session X". The guest
 * client fetches it right before signing in/up; the merge route later verifies
 * it against the freshly authenticated user id, so a guest's data can only be
 * claimed by the very session that created it. Tokens expire in 10 minutes.
 */
export function makeMergeToken(guestUserId: string, realUserId: string): string | null {
  const secret = process.env.MERGE_TOKEN_SECRET ?? process.env.GEMINI_API_KEY;
  if (!secret) return null;
  const expires = Date.now() + 10 * 60 * 1000;
  const payload = `${guestUserId}.${realUserId}.${expires}`;
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function verifyMergeToken(token: string, guestUserId: string, realUserId: string): boolean {
  const secret = process.env.MERGE_TOKEN_SECRET ?? process.env.GEMINI_API_KEY;
  if (!secret) return false;
  const parts = token.split(".");
  if (parts.length !== 4) return false;
  const [g, r, exp, sig] = parts;
  if (g !== guestUserId || r !== realUserId) return false;
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  const expected = createHmac("sha256", secret).update(`${g}.${r}.${exp}`).digest();
  const given = Buffer.from(sig, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Server-side Supabase client for Route Handlers / Server Components.
 * Reads the session cookies set by the browser client; Supabase SSR handles
 * token refresh through the cookie-based flow (middleware keeps them fresh).
 * Returns null when auth is not configured — callers treat that as
 * "authentication disabled" and keep legacy behavior.
 */
export async function createSupabaseServerClient() {
  if (!isSupabaseConfigured()) return null;

  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component render — safe to ignore because the
          // middleware refreshes sessions before they reach here.
        }
      },
    },
  });
}

/**
 * The authenticated user's id, or null when auth is disabled or nobody is
 * logged in. API routes use this to scope data to the user without caring
 * whether Supabase is configured at all.
 */
export async function getAuthUserId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}
