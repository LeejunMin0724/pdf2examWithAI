"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { difficultyLabel, typeLabel } from "@/lib/question-display";
import { type QuizQuestion } from "@/lib/questions";
import { type GradeResponse } from "@/components/quiz-session";

type QuestionSetSummary = {
  id: string;
  questionType: string;
  difficulty: string;
  requestedCount: number;
  createdAt: string;
  documentName: string;
  questionCount: number;
  latestAttemptId: string | null;
  latestAttemptScore: number | null;
  latestAttemptMaxScore: number | null;
};

type LoadedQuestionSet = {
  questionSetId: string;
  documentName: string;
  questions: QuizQuestion[];
};

type QuestionLibraryProps = {
  refreshToken: number;
  onReuse?: (questionSet: LoadedQuestionSet) => void;
  onViewResult?: (result: GradeResponse, questionSet: LoadedQuestionSet) => void;
};

export function QuestionLibrary({ refreshToken, onReuse, onViewResult }: QuestionLibraryProps) {
  const router = useRouter();
  const [questionSets, setQuestionSets] = useState<QuestionSetSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    fetch("/api/question-sets")
      .then(async (response) => {
        const payload = (await response.json()) as { questionSets?: QuestionSetSummary[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "문제은행을 불러오지 못했습니다.");
        if (!cancelled) setQuestionSets(payload.questionSets ?? []);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "문제은행을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [refreshToken]);

  async function reuseQuestionSet(id: string) {
    setLoadingId(id);
    setError(null);
    try {
      const response = await fetch(`/api/question-sets/${id}`);
      const payload = (await response.json()) as LoadedQuestionSet & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "문제 세트를 불러오지 못했습니다.");
      if (onReuse) onReuse(payload);
      else router.push(`/exam?set=${payload.questionSetId}`);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "문제 세트를 불러오지 못했습니다.");
    } finally {
      setLoadingId(null);
    }
  }

  async function deleteQuestionSet(questionSet: QuestionSetSummary) {
    const confirmed = window.confirm(
      `"${questionSet.documentName}" 문제 세트를 삭제할까요?\n저장된 문제와 풀이 기록이 모두 삭제되며 되돌릴 수 없습니다.`,
    );
    if (!confirmed) return;

    const previous = questionSets;
    setQuestionSets((sets) => sets.filter((set) => set.id !== questionSet.id)); // optimistic
    setError(null);
    setDeletingId(questionSet.id);
    try {
      const response = await fetch(`/api/question-sets/${questionSet.id}`, { method: "DELETE" });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? "문제 세트를 삭제하지 못했습니다.");
    } catch (deleteError) {
      setQuestionSets(previous); // roll back on failure
      setError(deleteError instanceof Error ? deleteError.message : "문제 세트를 삭제하지 못했습니다.");
    } finally {
      setDeletingId(null);
    }
  }

  async function viewResult(questionSet: QuestionSetSummary) {
    setLoadingId(questionSet.id);
    setError(null);
    try {
      const [attemptResponse, questionSetResponse] = await Promise.all([
        fetch(`/api/attempts/${questionSet.latestAttemptId}`),
        fetch(`/api/question-sets/${questionSet.id}`),
      ]);
      const payload = (await attemptResponse.json()) as GradeResponse & { error?: string };
      const questionSetPayload = (await questionSetResponse.json()) as LoadedQuestionSet & { error?: string };
      if (!attemptResponse.ok) throw new Error(payload.error ?? "풀이 결과를 불러오지 못했습니다.");
      if (!questionSetResponse.ok) throw new Error(questionSetPayload.error ?? "문제 세트를 불러오지 못했습니다.");
      if (onViewResult) onViewResult(payload, questionSetPayload);
      else router.push(`/exam?attempt=${payload.attemptId}&set=${questionSetPayload.questionSetId}`);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "풀이 결과를 불러오지 못했습니다.");
    } finally {
      setLoadingId(null);
    }
  }

  return <div className="question-library" aria-live="polite">
    {isLoading && <div className="library-placeholder" aria-busy="true">저장된 문제를 불러오는 중...</div>}
    {!isLoading && !questionSets.length && <div className="library-placeholder">
      <p>아직 저장된 문제 세트가 없습니다.</p>
      <p>PDF를 올리면 첫 시험가 만들어집니다.</p>
      <a className="btn btn-secondary btn-small" href="#upload">PDF로 첫 시험 만들기</a>
    </div>}
    {error && <p className="upload-error" role="alert">{error}</p>}
    {!!questionSets.length && <div className="saved-set-list">{questionSets.map((questionSet) => <article className="saved-set-card" key={questionSet.id}>
      <div><strong>{questionSet.documentName}</strong><span>{questionSet.questionCount}개 · {typeLabel[questionSet.questionType as keyof typeof typeLabel] ?? questionSet.questionType} · {difficultyLabel[questionSet.difficulty as keyof typeof difficultyLabel] ?? questionSet.difficulty}</span>{questionSet.latestAttemptId && <small className="saved-set-score">최근 점수 {questionSet.latestAttemptScore ?? 0} / {questionSet.latestAttemptMaxScore ?? 0}점</small>}</div>
      <div className="saved-set-actions"><button className="btn btn-ghost btn-small" disabled={loadingId === questionSet.id || deletingId === questionSet.id} onClick={() => reuseQuestionSet(questionSet.id)} type="button">{loadingId === questionSet.id ? "불러오는 중..." : "다시 풀기"}</button>{questionSet.latestAttemptId && <button className="btn btn-ghost btn-small" disabled={loadingId === questionSet.id || deletingId === questionSet.id} onClick={() => viewResult(questionSet)} type="button">결과 보기</button>}<button className="btn btn-ghost btn-small saved-set-delete" disabled={deletingId === questionSet.id} onClick={() => deleteQuestionSet(questionSet)} type="button">{deletingId === questionSet.id ? "삭제 중..." : "삭제"}</button></div>
    </article>)}</div>}
  </div>;
}
