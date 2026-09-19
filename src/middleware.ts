import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase-env";

/**
 * Keeps the Supabase session fresh on every request: when the access token is
 * close to expiring it exchanges the refresh token for a new one and rewrites
 * the cookies onto both the response and the proxied request. This is what
 * makes "stay logged in across refreshes / browser restarts" work — without it
 * the server would eventually see an expired session while the client still
 * has a valid refresh token.
 *
 * No route protection happens here: pages stay public. Unauthenticated users
 * simply see the logged-out UI, and user-data scoping is enforced per API
 * route via getAuthUserId().
 */
export async function middleware(request: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // IMPORTANT: do not remove. getUser() triggers the token refresh when needed.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except static assets:
     * - _next/static, _next/image (build artifacts)
     * - favicon, files with common image extensions
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
