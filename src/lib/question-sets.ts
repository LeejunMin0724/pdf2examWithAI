import { z } from "zod";
import { difficultySchema, questionTypeSchema, toDifficulty, type QuizQuestion } from "@/lib/questions";
import { prisma } from "@/lib/prisma";

export async function getQuestionSetQuestions(id: string) {
  const questionSet = await prisma.questionSet.findUnique({
    where: { id },
    include: { document: true, questions: { orderBy: { createdAt: "asc" } } },
  });
  if (!questionSet || questionSet.status !== "COMPLETE") return null;

  // MVP supports MULTIPLE_CHOICE and SUBJECTIVE only; skip legacy rows of removed types.
  const questions = questionSet.questions.filter((question) => isMvpQuestionType(question.type));

  return {
    questionSetId: questionSet.id,
    documentName: questionSet.document.originalName,
    // Actual model that generated this set (null for legacy/sample sets) —
    // the UI must use this, never a hardcoded name.
    generatedModel: questionSet.generatedModel ?? undefined,
    generatedModelName: questionSet.generatedModelName ?? undefined,
    generatedFallback: questionSet.generatedFallback ?? undefined,
    questions: questions.map((question) => toQuizQuestion(question, questionSet.document.originalName)),
  };
}

export function isMvpQuestionType(type: string): boolean {
  return type === "MULTIPLE_CHOICE" || type === "SUBJECTIVE";
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
}, sourcePdf: string): QuizQuestion {
  return {
    id: question.id,
    type: questionTypeSchema.parse(question.type),
    question: question.question,
    options: Array.isArray(question.options) ? question.options.filter((option): option is string => typeof option === "string") : undefined,
    maxScore: question.maxScore,
    explanation: question.explanation,
    difficulty: toDifficulty(difficultySchema.catch("EASY").parse(question.difficulty)),
    sourcePage: question.sourcePage,
    sourcePdf,
  };
}
