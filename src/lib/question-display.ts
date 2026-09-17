import type { QuizQuestion } from "@/lib/questions";
void (0 as unknown as QuizQuestion | null);

export const typeLabel: Record<string, string> = {
  MULTIPLE_CHOICE: "객관식",
  SHORT_ANSWER: "단답형",
  SUBJECTIVE: "서술형",
};

export const difficultyLabel: Record<string, string> = {
  EASY: "쉬움",
  MEDIUM: "보통",
  HARD: "어려움",
};

export function difficultyLabelFor(difficulty: string): string {
  return difficultyLabel[difficulty] ?? difficulty;
}

export function typeLabelFor(type: string): string {
  return typeLabel[type] ?? type;
}
