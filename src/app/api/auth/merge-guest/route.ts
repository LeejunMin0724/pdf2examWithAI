import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { createSupabaseServerClient, getAuthUserId, verifyMergeToken } from "@/lib/supabase-server";

export const runtime = "nodejs";

const prisma = new PrismaClient();

/**
 * Guest data migration. Called by the client right after a successful
 * password sign-in / sign-up that started from a guest session.
 *
 * Body: { token } — fetched from /api/auth/guest-token while still signed in
 * as the anonymous user (token payload: guestId.guestId.expires.sig).
 *
 * Flow:
 *   1. Verify the caller is now authenticated as a NON-anonymous user.
 *   2. Verify the token signature + expiry; the token's guest id must match
 *      the id encoded in the token (no cross-user guessing).
 *   3. Re-verify the token against (guestId, realUserId) via HMAC so only the
 *      session that fetched the token can claim the guest data.
 *   4. Move Document.userId / QuestionSet.userId / Attempt.userId rows from
 *      the guest id to the real user id in one transaction. Guest identity
 *      data (uploads, question sets, attempts, answers) is preserved as-is;
 *      only ownership changes.
 */
export async function POST(request: Request) {
  const realUserId = await getAuthUserId();
  if (!realUserId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const client = await createSupabaseServerClient();
  const { data, error } = await client!.auth.getUser();
  if (error || !data.user || data.user.is_anonymous === true) {
    return NextResponse.json({ error: "일반 계정으로 로그인한 상태가 아닙니다." }, { status: 403 });
  }

  let token = "";
  try {
    const body = (await request.json()) as { token?: unknown };
    if (typeof body.token === "string") token = body.token;
  } catch {
    // fallthrough — invalid JSON means invalid token below
  }
  if (!token) {
    return NextResponse.json({ error: "병합 토큰이 없습니다." }, { status: 400 });
  }

  // The token was issued with (guestId, guestId). Extract the guest id by
  // verifying that exact pairing first.
  const [guestId] = token.split(".");
  if (!guestId || guestId === realUserId) {
    return NextResponse.json({ error: "올바르지 않은 병합 요청입니다." }, { status: 400 });
  }
  if (!verifyMergeToken(token, guestId, guestId)) {
    return NextResponse.json({ error: "병합 토큰이 유효하지 않거나 만료되었습니다." }, { status: 403 });
  }

  const counts = await prisma.$transaction(async (tx) => {
    const documents = await tx.document.updateMany({
      where: { userId: guestId },
      data: { userId: realUserId },
    });
    const questionSets = await tx.questionSet.updateMany({
      where: { userId: guestId },
      data: { userId: realUserId },
    });
    const attempts = await tx.attempt.updateMany({
      where: { userId: guestId },
      data: { userId: realUserId },
    });
    return { documents: documents.count, questionSets: questionSets.count, attempts: attempts.count };
  });

  return NextResponse.json({ success: true, moved: counts });
}
