"use client";

import { useState } from "react";
import { type QuizQuestion } from "@/lib/questions";
import { difficultyLabel, typeLabel } from "@/lib/question-display";
import { MathText } from "@/components/math-text";

type QuizSessionProps = { questions: QuizQuestion[]; questionSetId?: string; documentName?: string; initialGradeResult?: GradeResponse | null; onSubmitted?: () => void; onGraded?: (result: GradeResponse) => void };

export type GradedResult = { questionId: string; type: QuizQuestion["type"]; question: string; studentResponse: string; maxScore: number; status: "GRADED" | "PENDING_AI_GRADE" | "AI_GRADE_FAILED"; score: number | null; isCorrect: boolean | null; correctAnswer: string | null; feedback: string | null; explanation: string };
export type GradeResponse = { attemptId: string; questionSetId?: string; score: number; maxScore: number; correctCount: number; totalQuestionCount: number; pendingCount: number; results: GradedResult[] };

function responseIsBlank(value: string | undefined) { return !value?.trim(); }

export function QuizSession({ questions, questionSetId, documentName, initialGradeResult, onSubmitted, onGraded }: QuizSessionProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [gradeResult, setGradeResult] = useState<GradeResponse | null>(initialGradeResult ?? null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRetrying, setIsRetrying] = useState<string | null>(null);
  const [showJumpNav, setShowJumpNav] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const activeQuestion = questions[activeIndex];
  const response = responses[activeQuestion.id] ?? "";
  const answeredCount = questions.filter((question) => !responseIsBlank(responses[question.id])).length;
  const unansweredCount = questions.length - answeredCount;
  const isLastQuestion = activeIndex === questions.length - 1;

  function saveResponse(value: string) { setResponses((current) => ({ ...current, [activeQuestion.id]: value })); }
  function moveToQuestion(index: number) { setShowSubmitConfirm(false); setActiveIndex(index); }
  function handleSubmitClick() {
    // Unanswered questions no longer block submission — ask once, then grade everything.
    if (unansweredCount > 0) setShowSubmitConfirm(true);
    else void submitAnswers();
  }

  async function retrySubjective(questionId: string) {
    if (!gradeResult) return;
    setIsRetrying(questionId);
    setSubmitError(null);
    try {
      const response = await fetch("/api/attempts/retry-subjective", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId: gradeResult.attemptId, questionId }),
      });
      const payload = (await response.json()) as { score?: number; feedback?: string; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "재채점에 실패했습니다.");
      setGradeResult((current) => current ? {
        ...current,
        pendingCount: Math.max(0, current.pendingCount - 1),
        results: current.results.map((result) => result.questionId === questionId ? { ...result, status: "GRADED", score: payload.score ?? null, isCorrect: payload.score === result.maxScore, feedback: payload.feedback ?? null } : result),
        score: current.score + (payload.score ?? 0),
      } : current);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "재채점에 실패했습니다.");
    } finally { setIsRetrying(null); }
  }

  async function submitAnswers() {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const response = await fetch("/api/attempts/grade", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionSetId: questionSetId ?? "sample", answers: questions.map((question) => ({ questionId: question.id, response: responses[question.id] ?? "" })) }),
      });
      const payload = (await response.json()) as GradeResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "채점 결과를 불러오지 못했습니다.");
      setGradeResult(payload);
      onGraded?.(payload);
      onSubmitted?.();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "채점에 실패했습니다. 다시 시도해 주세요.");
    } finally { setIsSubmitting(false); }
  }

  if (gradeResult) return <section className="result-panel" aria-live="polite">
    <div className="result-summary">
      <p className="eyebrow">채점 결과</p>
      <h2>{gradeResult.score} <small>/ {gradeResult.maxScore}점</small></h2>
      <p>{gradeResult.pendingCount > 0 ? `AI 채점 실패 ${gradeResult.pendingCount}개는 답안을 보존했습니다. 아래에서 다시 시도할 수 있어요.` : `총 ${gradeResult.totalQuestionCount}문제를 채점했습니다.`}</p>
      <button className="btn btn-ghost" onClick={() => setGradeResult(null)}>답안 다시 확인</button>
    </div>
    <div className="result-list">{gradeResult.results.map((result, index) => <article className="result-card" key={result.questionId}>
      <div className="result-card-top"><span>문제 {index + 1} · {typeLabel[result.type]}</span>{responseIsBlank(result.studentResponse) ? <strong className="badge badge-error">미응답 · 0점</strong> : result.status === "AI_GRADE_FAILED" ? <strong className="badge badge-error">× AI 채점 실패</strong> : result.type === "SUBJECTIVE" ? <strong className="badge badge-success">✓ AI 채점 완료</strong> : <strong className={`badge ${result.isCorrect ? "badge-success" : "badge-error"}`}>{result.isCorrect ? "✓ 정답" : "× 오답"}</strong>}</div>
      <h3><MathText text={result.question} /></h3>
      {/* 내 답은 학생이 직접 입력한 평문 그대로 보여준다(수식 렌더링 없음). */}
      <dl><div><dt>내 답</dt><dd>{result.studentResponse?.trim() ? result.studentResponse : "미응답"}</dd></div>{result.type !== "SUBJECTIVE" && result.correctAnswer && <div><dt>정답</dt><dd><MathText text={result.correctAnswer} /></dd></div>}{result.type === "SUBJECTIVE" && result.score !== null && <div><dt>점수</dt><dd>{result.score} / {result.maxScore}</dd></div>}</dl>
      {result.feedback && <p className="explanation"><b>{responseIsBlank(result.studentResponse) ? "안내" : result.status === "AI_GRADE_FAILED" ? "상태" : result.type === "SHORT_ANSWER" ? "판정" : "AI 피드백"}</b> <MathText text={result.feedback} /></p>}
      {result.status === "AI_GRADE_FAILED" && <button className="btn btn-ghost retry-button" disabled={isRetrying === result.questionId} onClick={() => retrySubjective(result.questionId)} type="button">{isRetrying === result.questionId ? "재채점 중..." : "AI 재채점"}</button>}
      <p className="explanation"><b>해설</b> <MathText text={result.explanation} /></p>
    </article>)}</div>
  </section>;

  return <section className="exam-session" aria-label="문제 풀이">
    <header className="exam-session-header">
      <div className="exam-session-info">
        <span className="exam-session-title">{documentName ?? "저장된 문제 세트"}</span>
        <span className="exam-session-progress">{answeredCount} / {questions.length} 답안 작성</span>
      </div>
      <div className="exam-session-track" role="progressbar" aria-valuemin={0} aria-valuemax={questions.length} aria-valuenow={answeredCount} aria-label="답안 작성 진행률"><span style={{ width: `${(answeredCount / questions.length) * 100}%` }} /></div>
      <div className="exam-session-nav-wrap">
        <button className="btn btn-ghost btn-small" type="button" aria-expanded={showJumpNav} onClick={() => setShowJumpNav((current) => !current)}>문제 이동</button>
      </div>
    </header>

    {showJumpNav && <div className="exam-jumpnav" role="group" aria-label="문제 선택">
      {questions.map((question, index) => <button aria-current={index === activeIndex ? "step" : undefined} className={`jump-dot ${index === activeIndex ? "current" : ""} ${responses[question.id] ? "answered" : ""}`} key={question.id} onClick={() => moveToQuestion(index)} type="button">{index + 1}</button>)}
    </div>}

    <article className="exam-question-area">
      <div className="exam-question-meta">
        <span className={`type type-${activeQuestion.type.toLowerCase()}`}>{typeLabel[activeQuestion.type]}</span>
        <span className="exam-question-count">문제 {activeIndex + 1} / {questions.length} · {difficultyLabel[activeQuestion.difficulty]}</span>
      </div>
      <h1 className="exam-question"><MathText text={activeQuestion.question} /></h1>

      {activeQuestion.type === "MULTIPLE_CHOICE" && <div className="options" role="radiogroup" aria-label="객관식 선택지">{activeQuestion.options?.map((option, index) => { const choice = String(index + 1); return <label className={`option ${response === choice ? "selected" : ""}`} key={option}><input checked={response === choice} name={activeQuestion.id} onChange={() => saveResponse(choice)} type="radio" value={choice} /><span className="choice-number">{index + 1}</span><span className="option-text"><MathText text={option} /></span></label>; })}</div>}
      {activeQuestion.type === "SHORT_ANSWER" && <label className="answer-field"><span>한 단어 또는 짧은 구절로 답하세요</span><input maxLength={60} onChange={(event) => saveResponse(event.target.value)} placeholder="답을 입력하세요." value={response} /><small>{response.length} / 60</small></label>}
      {activeQuestion.type === "SUBJECTIVE" && <label className="answer-field"><span>핵심 개념을 포함해 자유롭게 작성하세요</span><textarea maxLength={2000} onChange={(event) => saveResponse(event.target.value)} placeholder="답안을 입력하세요." rows={8} value={response} /><small>{response.length} / 2,000</small></label>}

      {showSubmitConfirm && unansweredCount > 0 && <div className="submit-confirm" role="alertdialog" aria-label="답하지 않은 문제 확인">
        <p><b>답하지 않은 문제가 {unansweredCount}개 있습니다.</b> 그대로 제출하면 해당 문제는 0점 처리됩니다. 그대로 제출할까요?</p>
        <div className="submit-confirm-actions">
          <button className="btn btn-ghost" disabled={isSubmitting} onClick={() => setShowSubmitConfirm(false)} type="button">계속 풀기</button>
          <button className="btn btn-primary" disabled={isSubmitting} onClick={() => { setShowSubmitConfirm(false); void submitAnswers(); }} type="button">{isSubmitting ? "채점 중..." : "그대로 제출"}</button>
        </div>
      </div>}

      <div className="exam-actions">
        <button className="btn btn-secondary" disabled={activeIndex === 0} onClick={() => moveToQuestion(activeIndex - 1)} type="button">이전</button>
        <div className="exam-actions-primary">
          {submitError && <p className="action-help" role="alert">{submitError}</p>}
          {isLastQuestion
            ? <button className="btn btn-primary" disabled={isSubmitting} onClick={handleSubmitClick} type="button">{isSubmitting ? "채점 중..." : "답안 제출"}</button>
            : <button className="btn btn-primary" onClick={() => moveToQuestion(activeIndex + 1)} type="button">다음</button>}
        </div>
      </div>
      {isLastQuestion && unansweredCount > 0 && !showSubmitConfirm && !submitError && <p className="action-help">답하지 않은 문제가 {unansweredCount}개 있습니다. 제출하면 0점 처리됩니다.</p>}
    </article>
  </section>;
}
