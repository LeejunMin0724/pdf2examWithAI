"use client";

import Link from "next/link";
import { difficultyLabel, typeLabel } from "@/lib/question-display";
import { type QuizQuestion } from "@/lib/questions";

export type GeneratedQuestionSet = {
  questionSetId: string;
  documentName: string;
  generatedModel?: string;
  generatedModelName?: string;
  generatedFallback?: boolean;
  questions: (QuizQuestion & { gradingRubric?: { criterion: string; points: number }[] })[];
};

type GeneratedPreviewProps = {
  set: GeneratedQuestionSet;
  /** Back navigation target label/href; defaults to the homepage upload section. */
  backHref?: string;
  onBack?: () => void;
};

/**
 * Read-only preview of a freshly generated question set (the confirm step
 * between 문제 생성 and 시험 풀이). No answer inputs, no submission, no timer —
 * answering begins only on the exam screen after [생성된 문제 풀기].
 * Question cards reuse the graded-result card styles (`.result-card`) without
 * their scoring/feedback elements, so the review screen inherits the app's
 * existing visual language.
 */
export function GeneratedPreview({ set, backHref = "/#upload", onBack }: GeneratedPreviewProps) {
  return (
    <div className="exam-shell generated-preview-shell">
      <header className="topbar exam-topbar">
        <Link className="brand" href="/" aria-label="PDF2Exam 홈">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/pdf2exam-logo.png" alt="PDF2Exam" className="brand-logo" />
        </Link>
        <div className="exam-topbar-meta" title={set.documentName}>
          <span className="exam-doc-name">{set.documentName}</span>
          {set.generatedModelName && (
            <span className="exam-model-badge" title="이 문제를 생성한 AI 모델">
              {set.generatedModelName}
              {set.generatedFallback && <em>· Fallback</em>}
            </span>
          )}
          <span className="exam-saved-badge">저장됨</span>
        </div>
        <nav aria-label="시험 메뉴">
          <Link href="/">종료</Link>
        </nav>
      </header>

      <main className="exam-main generated-preview-main">
        <section className="generated-preview" aria-label="생성된 문제 확인">
          <header className="generated-preview-header">
            <p className="eyebrow">문제 생성 완료</p>
            <h2>문제가 생성되었습니다.</h2>
            <p className="generated-preview-sub">
              {set.questions.length}개의 {set.questions[0] ? typeLabel[set.questions[0].type] : ""} 문제 ·
              답안 확인 후 시험을 시작하세요.
            </p>
            <div className="generated-preview-actions">
              {onBack
                ? <button className="btn btn-secondary" onClick={onBack} type="button">← 돌아가기</button>
                : <Link className="btn btn-secondary" href={backHref}>← 돌아가기</Link>}
              <Link
                className="btn btn-primary btn-large generated-preview-start"
                data-reveal-exit-ignore=""
                href={`/exam?set=${set.questionSetId}`}
              >
                생성된 문제 풀기
              </Link>
            </div>
          </header>

          <ol className="generated-preview-list">
            {set.questions.map((question, index) => (
              <li className="result-card generated-preview-card" key={question.id}>
                <div className="result-card-top">
                  <span>문제 {index + 1} · {typeLabel[question.type]} · {difficultyLabel[question.difficulty]}</span>
                  {question.sourcePage && <small className="generated-preview-page">PDF {question.sourcePage}쪽</small>}
                </div>
                <h3>{question.question}</h3>
                {question.type === "MULTIPLE_CHOICE" && (
                  <ul className="generated-preview-options">
                    {question.options?.map((option, optionIndex) => (
                      <li key={option}>
                        <span className="choice-number">{optionIndex + 1}</span>
                        {option}
                      </li>
                    ))}
                  </ul>
                )}
                {question.type === "SUBJECTIVE" && (
                  <dl>
                    <div>
                      <dt>채점 기준</dt>
                      <dd>{(question.gradingRubric ?? []).map((item) => item.criterion).join(" · ")}</dd>
                    </div>
                  </dl>
                )}
              </li>
            ))}
          </ol>

          <div className="generated-preview-actions generated-preview-footer">
            <Link className="btn btn-primary btn-large" href={`/exam?set=${set.questionSetId}`}>생성된 문제 풀기</Link>
          </div>
        </section>
      </main>
    </div>
  );
}
