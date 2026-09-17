import { z } from "zod";

export const questionTypeSchema = z.enum([
  "MULTIPLE_CHOICE",
  "SUBJECTIVE",
]);

export const difficultySchema = z.enum(["EASY", "HARD"]);

export const reasoningTypeSchema = z.enum([
  "recall",
  "concept_understanding",
  "comparison",
  "cause_and_effect",
  "application",
  "prediction",
  "mechanism",
  "error_detection",
  "multi_concept_reasoning",
]);

export const questionSchema = z.object({
  id: z.string(),
  type: questionTypeSchema,
  question: z.string().min(1),
  options: z.array(z.string()).length(4).optional(),
  correctAnswer: z.string().optional(),
  acceptedAnswers: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  modelAnswer: z.string().optional(),
  gradingRubric: z
    .array(z.object({ criterion: z.string(), points: z.number().positive() }))
    .optional(),
  maxScore: z.number().positive(),
  explanation: z.string().min(1),
  difficulty: difficultySchema,
  sourcePage: z.number().int().positive().nullable(),
  testedConcept: z.string().optional(),
  reasoningType: reasoningTypeSchema.optional(),
  sourcePdf: z.string(),
});

export type Question = z.infer<typeof questionSchema>;

/**
 * MVP supports EASY/HARD only. Legacy rows stored before the two-level system
 * (e.g. "MEDIUM") are read as EASY so old saved sets keep working.
 */
export function toDifficulty(value: string): Question["difficulty"] {
  return value === "HARD" ? "HARD" : "EASY";
}

const generatedQuestionSchema = z.object({
  type: questionTypeSchema,
  question: z.string().min(1),
  options: z.array(z.string().min(1)).length(4).optional(),
  correctAnswer: z.string().min(1).optional(),
  acceptedAnswers: z.array(z.string().min(1)).optional(),
  keywords: z.array(z.string().min(1)).optional(),
  modelAnswer: z.string().min(1).optional(),
  gradingRubric: z.array(z.object({ criterion: z.string().min(1), points: z.number().positive() })).optional(),
  maxScore: z.number().positive(),
  explanation: z.string().min(1),
  sourcePage: z.number().int().positive().nullable(),
  testedConcept: z.string().min(1).optional(),
  reasoningType: reasoningTypeSchema.optional(),
});

export const questionGenerationResponseSchema = z.object({
  questions: z.array(generatedQuestionSchema),
});

export type QuestionGenerationResponse = z.infer<typeof questionGenerationResponseSchema>;

export type QuestionGenerationInput = {
  questionType: Question["type"];
  count: number;
  difficulty: Question["difficulty"];
  sourceText: string;
};

export type SubjectiveGradeInput = {
  question: string;
  maxScore: number;
  modelAnswer: string;
  gradingRubric: string;
  studentAnswer: string;
};

export const subjectiveGradeResponseSchema = z.object({
  score: z.number().min(0),
  max_score: z.number().positive(),
  feedback: z.string().min(1).max(1000),
});

export type SubjectiveGradeResponse = z.infer<typeof subjectiveGradeResponseSchema>;

export const quizQuestionSchema = questionSchema.omit({
  correctAnswer: true,
  acceptedAnswers: true,
  keywords: true,
  modelAnswer: true,
  gradingRubric: true,
});

export type QuizQuestion = z.infer<typeof quizQuestionSchema>;

export function toQuizQuestion(question: Question): QuizQuestion {
  const { acceptedAnswers, correctAnswer, gradingRubric, keywords, modelAnswer, ...quizQuestion } = question;
  return quizQuestion;
}

export const sampleQuestions: Question[] = [
  {
    id: "sample-multiple-choice",
    type: "MULTIPLE_CHOICE",
    question: "세포막의 선택적 투과성에 대한 설명으로 가장 알맞은 것은 무엇인가요?",
    options: [
      "모든 물질을 같은 속도로 통과시킨다.",
      "물질의 성질에 따라 통과를 조절한다.",
      "세포 안의 물질만 밖으로 내보낸다.",
      "에너지를 사용하지 않고 물질을 만들 수 있다.",
    ],
    correctAnswer: "2",
    explanation: "세포막은 물질의 크기, 전하, 지용성 등에 따라 이동을 선택적으로 조절합니다.",
    maxScore: 1,
    difficulty: "EASY",
    sourcePage: 12,
    testedConcept: "세포막의 선택적 투과성",
    reasoningType: "recall",
    sourcePdf: "생명과학-세포막.pdf",
  },
  {
    id: "sample-subjective",
    type: "SUBJECTIVE",
    question: "등장액에 넣은 적혈구가 처음에는 부풀었다가 다시 원래 크기로 돌아오는 현상을 설명하세요.",
    modelAnswer: "처음 넣은 액체가 일시적으로 저등장이면 물이 세포 안으로 이동해 적혈구가 부풀고, 용질이 세포 안으로 유입되거나 대사되어 세포 내 외부 삼투압이 다시 같아지면 물의 순이동이 멈춰 원래 크기로 돌아온다. 핵심은 삼투(osmosis)가 삼투압 차이에 따른 물의 이동이라는 점이다.",
    gradingRubric: [
      { criterion: "삼투압(농도) 차이가 물 이동의 원인임을 설명", points: 2 },
      { criterion: "물의 이동 방향을 삼투압 차이와 연결", points: 2 },
      { criterion: "삼투압 평형이 되면 이동이 멈춘다고 설명", points: 1 },
    ],
    explanation: "삼투는 반투과성 막을 사이에 둔 삼투압 차이에 따른 물의 이동입니다. 세포 외액의 삼투압이 변하면 물이 이동하고, 평형이 되면 이동이 멈춥니다.",
    maxScore: 5,
    difficulty: "HARD",
    sourcePage: 16,
    testedConcept: "삼투와 삼투압 평형",
    reasoningType: "application",
    sourcePdf: "생명과학-세포막.pdf",
  },
];
