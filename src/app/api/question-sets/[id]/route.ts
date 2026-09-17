import { getQuestionSetQuestions } from "@/lib/question-sets";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const questionSet = await getQuestionSetQuestions(id);
  if (!questionSet) return Response.json({ error: "문제 세트를 찾을 수 없습니다." }, { status: 404 });
  return Response.json(questionSet);
}

/**
 * Deletes a question set from the server: the set, its questions, all attempts
 * and answers go with it (cascades). The uploaded PDF Document itself is kept —
 * it may back other question sets and can be reused for new generations.
 */
export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const questionSet = await prisma.questionSet.findUnique({ where: { id }, select: { id: true } });
  if (!questionSet) return Response.json({ error: "문제 세트를 찾을 수 없습니다." }, { status: 404 });
  await prisma.questionSet.delete({ where: { id } });
  return Response.json({ deletedId: id });
}
