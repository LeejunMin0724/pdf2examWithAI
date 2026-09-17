import { type Question } from "@/lib/questions";

export type ObjectiveGrade = { isCorrect: boolean; score: number; maxScore: number };

export function gradeObjectiveAnswer(question: Question, response: string): ObjectiveGrade | null {
  if (question.type === "MULTIPLE_CHOICE") {
    const isCorrect = response === question.correctAnswer;
    return { isCorrect, score: isCorrect ? question.maxScore : 0, maxScore: question.maxScore };
  }

  return null;
}
