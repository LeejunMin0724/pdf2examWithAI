import { z } from "zod";
import { AIServiceError, createAIService } from "@/lib/ai";
import { questionSchema } from "@/lib/questions";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/supabase-server";

export const runtime = "nodejs";

const retryRequestSchema = z.object({ attemptId: z.string().min(1), questionId: z.string().min(1) });

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = retryRequestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "재채점 요청 형식이 올바르지 않습니다." }, { status: 400 });

  const answer = await prisma.answer.findUnique({
    where: { attemptId_questionId: { attemptId: parsed.data.attemptId, questionId: parsed.data.questionId } },
    include: { question: true, attempt: { select: { userId: true } } },
  });
  if (!answer) return Response.json({ error: "답안을 찾을 수 없습니다." }, { status: 404 });

  // Signed-in users can only re-grade answers of their own attempts.
  const userId = await getAuthUserId();
  if (userId && answer.attempt.userId && answer.attempt.userId !== userId) {
    return Response.json({ error: "다른 사용자의 답안은 재채점할 수 없습니다." }, { status: 403 });
  }

  const question = questionSchema.parse({
    id: answer.question.id,
    type: answer.question.type,
    question: answer.question.question,
    options: toStringArray(answer.question.options),
    correctAnswer: answer.question.correctAnswer ?? undefined,
    acceptedAnswers: toStringArray(answer.question.acceptedAnswers),
    keywords: toStringArray(answer.question.keywords),
    modelAnswer: answer.question.modelAnswer ?? undefined,
    gradingRubric: toRubric(answer.question.gradingRubric),
    maxScore: answer.question.maxScore,
    explanation: answer.question.explanation,
    difficulty: answer.question.difficulty,
    sourcePage: answer.question.sourcePage,
    sourcePdf: "",
  });

  if (question.type !== "SUBJECTIVE" || !question.modelAnswer || !question.gradingRubric?.length) {
    return Response.json({ error: "서술형 문제만 AI 재채점할 수 있습니다." }, { status: 400 });
  }

  try {
    const grade = await createAIService().gradeSubjectiveAnswer({
      question: question.question,
      maxScore: question.maxScore,
      modelAnswer: question.modelAnswer,
      gradingRubric: JSON.stringify(question.gradingRubric),
      studentAnswer: answer.response,
    });
    await prisma.answer.update({
      where: { id: answer.id },
      data: { score: grade.score, isCorrect: grade.score === question.maxScore, feedback: grade.feedback, gradingStatus: "GRADED" },
    });
    await prisma.aIRequestLog.create({
      data: { operation: "GRADE_SUBJECTIVE", provider: grade.provider, model: grade.model, success: true },
    }).catch(() => undefined);
    const attemptAnswers = await prisma.answer.findMany({ where: { attemptId: answer.attemptId }, include: { question: { select: { maxScore: true } } } });
    await prisma.attempt.update({
      where: { id: answer.attemptId },
      data: {
        totalScore: attemptAnswers.reduce((sum, item) => sum + (item.score ?? 0), 0),
        maxScore: attemptAnswers.reduce((sum, item) => sum + item.question.maxScore, 0),
      },
    });
    return Response.json({ score: grade.score, maxScore: question.maxScore, feedback: grade.feedback, status: "GRADED" });
  } catch (error) {
    await prisma.answer.update({
      where: { id: answer.id },
      data: { gradingStatus: "AI_GRADE_FAILED", feedback: error instanceof AIServiceError ? error.message : "AI 채점에 실패했습니다." },
    });
    await prisma.aIRequestLog.create({
      data: {
        operation: "GRADE_SUBJECTIVE",
        provider: process.env.OPENROUTER_API_KEY?.trim() ? "openrouter" : "google",
        model: error instanceof AIServiceError && error.model ? error.model : "pool-exhausted",
        success: false,
        errorCode: error instanceof AIServiceError ? error.code : "UNKNOWN",
      },
    }).catch(() => undefined);
    return Response.json({ error: error instanceof AIServiceError ? error.message : "AI 채점에 실패했습니다." }, { status: 502 });
  }
}

function toStringArray(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : undefined; }
function toRubric(value: unknown) { return Array.isArray(value) ? value.filter((item): item is { criterion: string; points: number } => typeof item === "object" && item !== null && "criterion" in item && "points" in item && typeof item.criterion === "string" && typeof item.points === "number") : undefined; }
