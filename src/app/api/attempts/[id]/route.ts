import { questionSchema, type Question } from "@/lib/questions";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };
type ResultStatus = "GRADED" | "PENDING_AI_GRADE" | "AI_GRADE_FAILED";

type Result = {
  questionId: string;
  type: Question["type"];
  question: string;
  studentResponse: string;
  maxScore: number;
  status: ResultStatus;
  score: number | null;
  isCorrect: boolean | null;
  correctAnswer: string | null;
  feedback: string | null;
  explanation: string;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const attempt = await prisma.attempt.findUnique({
    where: { id },
    include: {
      questionSet: {
        include: {
          document: true,
          questions: { orderBy: { createdAt: "asc" } },
        },
      },
      answers: { include: { question: true } },
    },
  });

  if (!attempt) return Response.json({ error: "학습 결과를 찾을 수 없습니다." }, { status: 404 });

  const questions = attempt.questionSet.questions.map((question) => toQuestion(question, attempt.questionSet.document.originalName));
  const answerByQuestionId = new Map(attempt.answers.map((answer) => [answer.questionId, answer]));
  const results: Result[] = questions.flatMap((question) => {
    const answer = answerByQuestionId.get(question.id);
    if (!answer) return [];
    return [{
      questionId: question.id,
      type: question.type,
      question: question.question,
      studentResponse: answer.response,
      maxScore: question.maxScore,
      status: toResultStatus(answer.gradingStatus),
      score: answer.score,
      isCorrect: answer.isCorrect,
      correctAnswer: question.correctAnswer ?? question.modelAnswer ?? null,
      feedback: answer.feedback,
      explanation: question.explanation,
    }];
  });

  const score = results.reduce((sum, result) => sum + (result.score ?? 0), 0);
  const maxScore = results.reduce((sum, result) => sum + result.maxScore, 0);
  const pendingCount = results.filter((result) => result.status !== "GRADED").length;

  if (attempt.totalScore !== score || attempt.maxScore !== maxScore) {
    await prisma.attempt.update({ where: { id }, data: { totalScore: score, maxScore } });
  }

  return Response.json({
    attemptId: attempt.id,
    questionSetId: attempt.questionSetId,
    score,
    maxScore,
    correctCount: results.filter((result) => result.isCorrect).length,
    totalQuestionCount: results.length,
    pendingCount,
    results,
  });
}

function toQuestion(
  record: {
    id: string;
    type: string;
    question: string;
    options: unknown;
    correctAnswer: string | null;
    acceptedAnswers: unknown;
    keywords: unknown;
    modelAnswer: string | null;
    gradingRubric: unknown;
    maxScore: number;
    explanation: string;
    difficulty: string;
    sourcePage: number | null;
  },
  sourcePdf: string,
): Question {
  return questionSchema.parse({
    id: record.id,
    type: record.type,
    question: record.question,
    options: toStringArray(record.options),
    correctAnswer: record.correctAnswer ?? undefined,
    acceptedAnswers: toStringArray(record.acceptedAnswers),
    keywords: toStringArray(record.keywords),
    modelAnswer: record.modelAnswer ?? undefined,
    gradingRubric: toRubric(record.gradingRubric),
    maxScore: record.maxScore,
    explanation: record.explanation,
    difficulty: record.difficulty,
    sourcePage: record.sourcePage,
    sourcePdf,
  });
}

function toResultStatus(value: string): ResultStatus {
  if (value === "AI_GRADE_FAILED") return "AI_GRADE_FAILED";
  if (value === "PENDING_AI_GRADE") return "PENDING_AI_GRADE";
  return "GRADED";
}

function toStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : undefined;
}

function toRubric(value: unknown) {
  return Array.isArray(value)
    ? value.filter(
        (item): item is { criterion: string; points: number } =>
          typeof item === "object" &&
          item !== null &&
          "criterion" in item &&
          "points" in item &&
          typeof item.criterion === "string" &&
          typeof item.points === "number",
      )
    : undefined;
}
