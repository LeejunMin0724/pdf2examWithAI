import { z } from "zod";
import { AIServiceError, createAIService } from "@/lib/ai";
import { gradeObjectiveAnswer } from "@/lib/grading";
import { isMvpQuestionType } from "@/lib/question-sets";
import { questionSchema, sampleQuestions, toDifficulty, type Question } from "@/lib/questions";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/supabase-server";

export const runtime = "nodejs";

const gradeRequestSchema = z.object({
  questionSetId: z.string().min(1),
  answers: z.array(z.object({
    questionId: z.string().min(1),
    response: z.string().trim().min(1).max(2000),
  })).min(1).max(30),
});

type StoredQuestion = Question & { questionSetId: string };
type AnswerRecord = { id: string; questionId: string; response: string; gradingStatus: string };

type GradeResult = {
  questionId: string;
  type: Question["type"];
  question: string;
  studentResponse: string;
  maxScore: number;
  status: "GRADED" | "PENDING_AI_GRADE" | "AI_GRADE_FAILED";
  score: number | null;
  isCorrect: boolean | null;
  correctAnswer: string | null;
  feedback: string | null;
  explanation: string;
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = gradeRequestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "답안 형식이 올바르지 않습니다." }, { status: 400 });

  const questionSetId = parsed.data.questionSetId === "sample" ? await ensureSampleQuestionSet() : parsed.data.questionSetId;
  const userId = await getAuthUserId();
  const questionSet = await prisma.questionSet.findUnique({ where: { id: questionSetId }, include: { document: true, questions: true } });
  if (!questionSet) return Response.json({ error: "문제 세트를 찾을 수 없습니다." }, { status: 404 });
  if (questionSet.status !== "COMPLETE") return Response.json({ error: "아직 풀 수 없는 문제 세트입니다." }, { status: 409 });
  // Signed-in users can only submit answers to their own sets.
  if (userId && questionSet.userId && questionSet.userId !== userId) {
    return Response.json({ error: "다른 사용자의 문제 세트에는 답안을 제출할 수 없습니다." }, { status: 403 });
  }

  // MVP supports MULTIPLE_CHOICE and SUBJECTIVE only; skip legacy rows of removed types.
  const mvpQuestions = questionSet.questions.filter((question) => isMvpQuestionType(question.type));
  const questions = mvpQuestions.map((question) => toQuestion(question, questionSet.document.originalName));
  const questionById = new Map(questions.map((question) => [question.id, question]));
  const submittedIds = new Set(parsed.data.answers.map((answer) => answer.questionId));
  if (submittedIds.size !== parsed.data.answers.length || questions.length !== parsed.data.answers.length || questions.some((question) => !submittedIds.has(question.id))) {
    return Response.json({ error: "문제 세트의 모든 답안을 한 번씩 제출해야 합니다." }, { status: 400 });
  }

  const attempt = await prisma.attempt.create({
    data: {
      questionSetId,
      userId,
      answers: {
        create: parsed.data.answers.map((answer) => {
          const question = questionById.get(answer.questionId)!;
          const objectiveGrade = gradeObjectiveAnswer(question, answer.response);
          return {
            questionId: answer.questionId,
            response: answer.response,
            isCorrect: objectiveGrade?.isCorrect ?? null,
            score: objectiveGrade?.score ?? null,
            gradingStatus: objectiveGrade ? "GRADED" : "PENDING_AI_GRADE",
          };
        }),
      },
    },
    include: { answers: true },
  });

  await gradeSubjectiveAnswers(attempt.answers, questionById);
  return buildGradeResponse(attempt.id, questionById);
}

async function gradeSubjectiveAnswers(answers: AnswerRecord[], questionById: Map<string, Question>) {
  const aiService = createAIService();
  await Promise.all(answers.filter((answer) => answer.gradingStatus === "PENDING_AI_GRADE").map(async (answer) => {
    const question = questionById.get(answer.questionId);
    if (!question?.modelAnswer || !question.gradingRubric?.length) return;
    try {
      const grade = await aiService.gradeSubjectiveAnswer({
        question: question.question,
        maxScore: question.maxScore,
        modelAnswer: question.modelAnswer,
        gradingRubric: JSON.stringify(question.gradingRubric),
        studentAnswer: answer.response,
      });
      await prisma.answer.update({ where: { id: answer.id }, data: { score: grade.score, isCorrect: grade.score === question.maxScore, feedback: grade.feedback, gradingStatus: "GRADED" } });
      await prisma.aIRequestLog.create({
        data: { operation: "GRADE_SUBJECTIVE", provider: grade.provider, model: grade.model, success: true },
      }).catch(() => undefined);
    } catch (error) {
      await prisma.answer.update({ where: { id: answer.id }, data: { gradingStatus: "AI_GRADE_FAILED", feedback: error instanceof AIServiceError ? error.message : "AI 채점에 실패했습니다." } });
      await prisma.aIRequestLog.create({
        data: {
          operation: "GRADE_SUBJECTIVE",
          provider: process.env.OPENROUTER_API_KEY?.trim() ? "openrouter" : "google",
          model: error instanceof AIServiceError && error.model ? error.model : "pool-exhausted",
          success: false,
          errorCode: error instanceof AIServiceError ? error.code : "UNKNOWN",
        },
      }).catch(() => undefined);
    }
  }));
}

async function buildGradeResponse(attemptId: string, questionById: Map<string, Question>) {
  const attempt = await prisma.attempt.findUniqueOrThrow({ where: { id: attemptId }, include: { answers: true } });
  const results: GradeResult[] = attempt.answers.map((answer) => {
    const question = questionById.get(answer.questionId)!;
    const status = answer.gradingStatus === "AI_GRADE_FAILED" ? "AI_GRADE_FAILED" : answer.gradingStatus === "PENDING_AI_GRADE" ? "PENDING_AI_GRADE" : "GRADED";
    return {
      questionId: question.id,
      type: question.type,
      question: question.question,
      studentResponse: answer.response,
      maxScore: question.maxScore,
      status,
      score: answer.score,
      isCorrect: answer.isCorrect,
      correctAnswer: question.correctAnswer ?? question.modelAnswer ?? null,
      feedback: answer.feedback,
      explanation: question.explanation,
    };
  });
  const score = results.reduce((sum, result) => sum + (result.score ?? 0), 0);
  const maxScore = results.reduce((sum, result) => sum + result.maxScore, 0);
  await prisma.attempt.update({ where: { id: attemptId }, data: { submittedAt: new Date(), totalScore: score, maxScore } });
  return Response.json({ attemptId, score, maxScore, correctCount: results.filter((result) => result.isCorrect).length, totalQuestionCount: results.length, pendingCount: results.filter((result) => result.status !== "GRADED").length, results });
}

async function ensureSampleQuestionSet() {
  await prisma.document.upsert({ where: { id: "sample-document" }, update: {}, create: { id: "sample-document", originalName: "생명과학-세포막.pdf", storageKey: "sample", extractionState: "COMPLETE", pageCount: 1 } });
  await prisma.questionSet.upsert({ where: { id: "sample-question-set" }, update: {}, create: { id: "sample-question-set", documentId: "sample-document", questionType: "MIXED", difficulty: "MEDIUM", requestedCount: sampleQuestions.length, status: "COMPLETE" } });
  await Promise.all(sampleQuestions.map((question) => prisma.question.upsert({
    where: { id: question.id },
    update: {},
    create: { id: question.id, questionSetId: "sample-question-set", type: question.type, question: question.question, options: question.options, correctAnswer: question.correctAnswer, acceptedAnswers: question.acceptedAnswers, keywords: question.keywords, modelAnswer: question.modelAnswer, gradingRubric: question.gradingRubric, maxScore: question.maxScore, explanation: question.explanation, difficulty: question.difficulty, sourcePage: question.sourcePage },
  })));
  return "sample-question-set";
}

function toQuestion(record: { id: string; questionSetId: string; type: string; question: string; options: unknown; correctAnswer: string | null; acceptedAnswers: unknown; keywords: unknown; modelAnswer: string | null; gradingRubric: unknown; maxScore: number; explanation: string; difficulty: string; sourcePage: number | null; testedConcept?: string | null; reasoningType?: string | null }, sourcePdf: string): StoredQuestion {
  return { ...questionSchema.parse({ id: record.id, type: record.type, question: record.question, options: toStringArray(record.options), correctAnswer: record.correctAnswer ?? undefined, acceptedAnswers: toStringArray(record.acceptedAnswers), keywords: toStringArray(record.keywords), modelAnswer: record.modelAnswer ?? undefined, gradingRubric: toRubric(record.gradingRubric), maxScore: record.maxScore, explanation: record.explanation, difficulty: toDifficulty(record.difficulty), sourcePage: record.sourcePage, testedConcept: record.testedConcept ?? undefined, reasoningType: record.reasoningType ?? undefined, sourcePdf }), questionSetId: record.questionSetId };
}

function toStringArray(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : undefined; }
function toRubric(value: unknown) { return Array.isArray(value) ? value.filter((item): item is { criterion: string; points: number } => typeof item === "object" && item !== null && "criterion" in item && "points" in item && typeof item.criterion === "string" && typeof item.points === "number") : undefined; }
