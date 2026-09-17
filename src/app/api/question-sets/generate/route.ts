import { z } from "zod";
import { AIServiceError, createAIService } from "@/lib/ai";
import { difficultySchema, questionTypeSchema, reasoningTypeSchema, type QuizQuestion } from "@/lib/questions";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const generateRequestSchema = z.object({
  documentId: z.string().min(1),
  questionType: questionTypeSchema,
  count: z.number().int().min(1).max(20),
  difficulty: difficultySchema,
});

type GenerateResponse = {
  questionSetId: string;
  questions: QuizQuestion[];
  provider: string;
  model: string;
  displayName: string;
  fallback: boolean;
  fallbackReason?: string;
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = generateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "문제 생성 요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const { documentId, questionType, count, difficulty } = parsed.data;
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: { pages: { orderBy: { pageNumber: "asc" } } },
  });

  if (!document) return Response.json({ error: "업로드된 문서를 찾을 수 없습니다." }, { status: 404 });

  const sourceText = document.pages
    .filter((page) => page.text.trim())
    .map((page) => `[Page ${page.pageNumber}]\n${page.text}`)
    .join("\n\n");
  if (!sourceText) return Response.json({ error: "문서에서 추출된 텍스트가 없습니다." }, { status: 422 });

  const questionSet = await prisma.questionSet.create({
    data: {
      documentId,
      questionType,
      difficulty,
      requestedCount: count,
      status: "GENERATING",
    },
  });

  try {
    const generated = await createAIService().generateQuestions({
      questionType,
      count,
      difficulty,
      sourceText: sourceText.slice(0, 120_000),
    });
    const questions = generated.questions.map((question) => {
      if (question.type !== questionType) {
        throw new AIServiceError("LLM 응답에 요청한 문제 유형이 아닌 문제가 포함되었습니다.", "MALFORMED_RESPONSE");
      }
      if (questionType === "MULTIPLE_CHOICE" && (!question.options || !question.correctAnswer)) {
        throw new AIServiceError("객관식 문제의 선택지 또는 정답이 누락되었습니다.", "MALFORMED_RESPONSE");
      }
      if (questionType === "SUBJECTIVE" && (!question.modelAnswer || !question.gradingRubric?.length)) {
        throw new AIServiceError("서술형 문제의 모범 답안 또는 채점 기준이 누락되었습니다.", "MALFORMED_RESPONSE");
      }
      return question;
    });

    await prisma.questionSet.update({
      where: { id: questionSet.id },
      data: {
        status: "COMPLETE",
        generatedModel: generated.model,
        generatedModelName: generated.displayName,
        generatedFallback: generated.fallback,
        questions: {
          create: questions.map((question) => ({
            type: question.type,
            question: question.question,
            options: question.options,
            correctAnswer: question.correctAnswer,
            acceptedAnswers: question.acceptedAnswers,
            keywords: question.keywords,
            modelAnswer: question.modelAnswer,
            gradingRubric: question.gradingRubric,
            maxScore: question.maxScore,
            explanation: question.explanation,
            difficulty,
            sourcePage: question.sourcePage,
            testedConcept: question.testedConcept,
            reasoningType: question.reasoningType,
          })),
        },
      },
    });

    await prisma.aIRequestLog.create({
      data: {
        operation: "GENERATE_QUESTIONS",
        provider: generated.provider,
        model: generated.model,
        success: true,
      },
    });

    const savedQuestions = await prisma.question.findMany({
      where: { questionSetId: questionSet.id },
      orderBy: { createdAt: "asc" },
    });

    return Response.json({
      questionSetId: questionSet.id,
      questions: savedQuestions.map(toQuizQuestion),
      provider: generated.provider,
      model: generated.model,
      displayName: generated.displayName,
      fallback: generated.fallback,
      ...(generated.fallbackReason ? { fallbackReason: generated.fallbackReason } : {}),
    } satisfies GenerateResponse);
  } catch (error) {
    await prisma.questionSet.update({ where: { id: questionSet.id }, data: { status: "FAILED" } }).catch(() => undefined);
    await prisma.aIRequestLog.create({
      data: {
        operation: "GENERATE_QUESTIONS",
        // OpenRouter was configured: the failure came after walking the whole
        // Gemini pool (or from it) — record where the chain actually ended.
        provider: process.env.OPENROUTER_API_KEY?.trim() ? "openrouter" : "google",
        model: error instanceof AIServiceError && error.model ? error.model : "pool-exhausted",
        success: false,
        errorCode: error instanceof AIServiceError ? error.code : "UNKNOWN",
      },
    }).catch(() => undefined);

    if (error instanceof AIServiceError) {
      const status = error.code === "CONFIGURATION" ? 503 : error.code === "MALFORMED_RESPONSE" ? 502 : 502;
      return Response.json({ error: error.message }, { status });
    }
    return Response.json({ error: "문제 생성 중 오류가 발생했습니다. 다시 시도해 주세요." }, { status: 500 });
  }
}

function toQuizQuestion(question: {
  id: string;
  type: string;
  question: string;
  options: unknown;
  maxScore: number;
  explanation: string;
  difficulty: string;
  sourcePage: number | null;
  testedConcept: string | null;
  reasoningType: string | null;
}): QuizQuestion {
  return {
    id: question.id,
    type: questionTypeSchema.parse(question.type),
    question: question.question,
    options: Array.isArray(question.options) ? question.options.filter((option): option is string => typeof option === "string") : undefined,
    maxScore: question.maxScore,
    explanation: question.explanation,
    difficulty: difficultySchema.parse(question.difficulty),
    sourcePage: question.sourcePage,
    testedConcept: question.testedConcept ?? undefined,
    reasoningType: reasoningTypeSchema.catch("recall").parse(question.reasoningType ?? "recall"),
    sourcePdf: "",
  };
}
