import { getQuestionSetQuestions } from "@/lib/question-sets";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/supabase-server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const questionSet = await getQuestionSetQuestions(id);
  if (!questionSet) return Response.json({ error: "문제 세트를 찾을 수 없습니다." }, { status: 404 });
  // Ownership check: signed-in users cannot read another user's set. Sets
  // without an owner (auth disabled / legacy / sample) stay publicly readable.
  const userId = await getAuthUserId();
  const owner = await prisma.questionSet.findUnique({ where: { id }, select: { userId: true } });
  if (userId && owner?.userId && owner.userId !== userId) {
    return Response.json({ error: "다른 사용자의 문제 세트에는 접근할 수 없습니다." }, { status: 403 });
  }
  return Response.json(questionSet);
}

/**
 * Deletes a question set from the server: the set, its questions, all attempts
 * and answers go with it (cascades). The uploaded PDF Document itself is kept —
 * it may back other question sets and can be reused for new generations.
 */
export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const userId = await getAuthUserId();
  const questionSet = await prisma.questionSet.findUnique({ where: { id }, select: { id: true, userId: true } });
  if (!questionSet) return Response.json({ error: "문제 세트를 찾을 수 없습니다." }, { status: 404 });
  // Signed-in users may only delete their own sets (ownerless/legacy sets are
  // only deletable while auth is off — same behavior as before).
  if (userId && questionSet.userId && questionSet.userId !== userId) {
    return Response.json({ error: "다른 사용자의 문제 세트는 삭제할 수 없습니다." }, { status: 403 });
  }
  await prisma.questionSet.delete({ where: { id } });
  return Response.json({ deletedId: id });
}
