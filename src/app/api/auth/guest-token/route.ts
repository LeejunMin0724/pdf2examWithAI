import { NextResponse } from "next/server";
import { createSupabaseServerClient, getAuthUserId, makeMergeToken } from "@/lib/supabase-server";

export const runtime = "nodejs";

/**
 * A signed-in guest calls this right before signing in / signing up with a
 * real account. Returns a short-lived signed token that binds the current
 * anonymous user id to the upcoming credentials. No data is touched here.
 */
export async function GET() {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: "인증 세션이 없습니다." }, { status: 401 });
  }

  const client = await createSupabaseServerClient();
  const { data, error } = await client!.auth.getUser();
  if (error || !data.user) {
    return NextResponse.json({ error: "인증 세션이 없습니다." }, { status: 401 });
  }
  if (data.user.is_anonymous !== true) {
    return NextResponse.json({ error: "게스트 세션이 아닙니다." }, { status: 400 });
  }

  // Issued for THIS guest id; the merge route verifies it against the real
  // user id produced by the password sign-in before touching any rows.
  const token = makeMergeToken(userId, userId);
  if (!token) {
    return NextResponse.json({ error: "병합 토큰을 만들 수 없습니다." }, { status: 500 });
  }

  return NextResponse.json({ token });
}
