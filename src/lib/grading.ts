import { latexToPlain } from "@/lib/notation";
import { type Question } from "@/lib/questions";

export type ObjectiveGrade = { isCorrect: boolean; score: number; maxScore: number };

/**
 * Characters that never carry meaning in a short answer: sentence punctuation
 * and quotes. `+ - / ° º ( )` are deliberately KEPT — stripping them would make
 * "Na+" and "Na" the same answer, or "sp2" and "sp3" collide after superscripts.
 */
const IGNORED_CHARACTERS = /[.,;:!?"'“”‘’·。、「」]/g;

/** Trailing Korean particles a student tacks onto the answer ("삼투압은"). */
const TRAILING_PARTICLES = /(이다|였습니다|입니다|인가|이고|은|는|이|가|을|를|의|에|로|으로|와|과|도|만)$/;

/**
 * Short answers are compared after light normalization — width, case, spacing,
 * punctuation and a trailing particle. Everything else (synonyms, unit formats,
 * other notations) is the AI reviewer's job, which is why this stays strict:
 * a false "정답" here is much worse than a question the reviewer has to rescue.
 *
 * Typography is folded back to ASCII first, because answers/typeset text are
 * written both ways: a question stores "$\ce{H2O}$", "6.02×10²³" or "H₂O" while a
 * student on a keyboard types "H2O" or "6.02x10^23" — `latexToPlain` removes the
 * rendering markup, NFKC handles the sub/superscripts, and the folds below handle
 * the symbols it leaves alone.
 */
export function normalizeShortAnswer(value: string) {
  return latexToPlain(value)
    .normalize("NFKC")
    .replace(/[×✕✖]/g, "x")
    .replace(/[·⋅∙]/g, ".")
    .replace(/[→➔➜]/g, "->")
    .replace(/[⇌⇋⇄]/g, "=")
    .replace(/[−–—]/g, "-")
    .replace(/[()[\]{}]/g, "")
    .replace(/[°^~`'"””]/g, "")
    .replace(IGNORED_CHARACTERS, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function shortAnswerMatches(expected: string, response: string) {
  const normalizedResponse = normalizeShortAnswer(response);
  if (!normalizedResponse) return false;
  const normalizedExpected = normalizeShortAnswer(expected);
  if (!normalizedExpected) return false;
  if (normalizedResponse === normalizedExpected) return true;
  return normalizedResponse.replace(TRAILING_PARTICLES, "") === normalizedExpected.replace(TRAILING_PARTICLES, "");
}

/**
 * Deterministic grading for every answer type that does not need a model call:
 * multiple choice (1-indexed option string) and short answer (normalized match
 * against the canonical answer or any accepted variant). Returns null for types
 * the AI grades (currently SUBJECTIVE).
 */
export function gradeObjectiveAnswer(question: Question, response: string): ObjectiveGrade | null {
  if (question.type === "MULTIPLE_CHOICE") {
    const isCorrect = response === question.correctAnswer;
    return { isCorrect, score: isCorrect ? question.maxScore : 0, maxScore: question.maxScore };
  }

  if (question.type === "SHORT_ANSWER") {
    const candidates = [question.correctAnswer, ...(question.acceptedAnswers ?? [])].filter(
      (candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0,
    );
    const isCorrect = candidates.some((candidate) => shortAnswerMatches(candidate, response));
    return { isCorrect, score: isCorrect ? question.maxScore : 0, maxScore: question.maxScore };
  }

  return null;
}
