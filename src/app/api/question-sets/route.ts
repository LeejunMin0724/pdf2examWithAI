import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const questionSetSummarySchema = z.object({
  id: z.string(),
  questionType: z.string(),
  difficulty: z.string(),
  requestedCount: z.number(),
  createdAt: z.string(),
  documentName: z.string(),
  questionCount: z.number(),
  latestAttemptId: z.string().nullable(),
  latestAttemptScore: z.number().nullable(),
  latestAttemptMaxScore: z.number().nullable(),
});

export async function GET() {
  const questionSets = await prisma.questionSet.findMany({
    where: { status: "COMPLETE" },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: {
      document: { select: { originalName: true } },
      _count: { select: { questions: true } },
      attempts: {
        orderBy: { startedAt: "desc" },
        take: 1,
        select: { id: true, totalScore: true, maxScore: true },
      },
    },
  });

  return Response.json({
    questionSets: questionSets.map((questionSet) =>
      questionSetSummarySchema.parse({
        id: questionSet.id,
        questionType: questionSet.questionType,
        difficulty: questionSet.difficulty,
        requestedCount: questionSet.requestedCount,
        createdAt: questionSet.createdAt.toISOString(),
        documentName: questionSet.document.originalName,
        questionCount: questionSet._count.questions,
        latestAttemptId: questionSet.attempts[0]?.id ?? null,
        latestAttemptScore: questionSet.attempts[0]?.totalScore ?? null,
        latestAttemptMaxScore: questionSet.attempts[0]?.maxScore ?? null,
      }),
    ),
  });
}
