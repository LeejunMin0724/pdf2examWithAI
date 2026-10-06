/**
 * Regression check against the questions already stored in the database: the new
 * notation pipeline must leave existing plain-Unicode text alone (formatNotation
 * is a no-op on it) and must flatten new LaTeX/mhchem text back to readable text.
 */
import { PrismaClient } from "@prisma/client";
import { formatNotation, latexToPlain } from "./notation-build/notation.js";

const prisma = new PrismaClient();
const questions = await prisma.question.findMany({
  select: { id: true, question: true, options: true, correctAnswer: true, explanation: true, modelAnswer: true, acceptedAnswers: true },
});

const changed = [];
for (const question of questions) {
  for (const [field, value] of Object.entries(question)) {
    if (typeof value !== "string" || !value) continue;
    const formatted = formatNotation(value);
    if (formatted !== value) changed.push({ id: question.id.slice(0, 8), field, before: value.slice(0, 90), after: formatted.slice(0, 90) });
  }
  for (const option of question.options ?? []) {
    if (formatNotation(option) !== option) changed.push({ id: question.id.slice(0, 8), field: "option", before: option.slice(0, 90), after: formatNotation(option).slice(0, 90) });
  }
}

console.log(`questions scanned: ${questions.length}`);
console.log(`fields that formatNotation would rewrite: ${changed.length}`);
for (const item of changed.slice(0, 12)) console.log(` - [${item.id}] ${item.field}\n   before: ${item.before}\n   after:  ${item.after}`);

console.log("\nlatexToPlain round-trip on stored text (first 3 questions):");
for (const question of questions.slice(0, 3)) {
  console.log(` - ${JSON.stringify(latexToPlain(question.question).slice(0, 80))}`);
}

await prisma.$disconnect();
