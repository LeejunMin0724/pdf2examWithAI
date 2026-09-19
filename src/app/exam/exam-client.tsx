"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { GeneratedPreview } from "@/components/generated-preview";
import { QuizSession, type GradeResponse } from "@/components/quiz-session";
import { AuthMenu } from "@/components/auth-menu";
import { sampleQuestions, toQuizQuestion, type QuizQuestion } from "@/lib/questions";

type LoadedQuestionSet = {
  questionSetId: string;
  documentName: string;
  generatedModel?: string;
  generatedModelName?: string;
  generatedFallback?: boolean;
  questions: QuizQuestion[];
};

const SAMPLE_QUESTION_SET_ID = "sample";
const SAMPLE_DOCUMENT_NAME = "생명과학-세포막.pdf";

export function ExamClient() {
  const searchParams = useSearchParams();
  const setId = searchParams.get("set");
  const attemptId = searchParams.get("attempt");
  // ?preview=1 renders the read-only generated-question confirmation screen
  // (문제가 생성되었습니다 → [생성된 문제 풀기]). The exam timer/answering never
  // starts in this mode; clicking the CTA simply drops the query param.
  const previewParam = searchParams.get("preview");
  const preview = previewParam === "1" || previewParam === "true";

  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [documentName, setDocumentName] = useState("");
  const [questionSetId, setQuestionSetId] = useState("");
  const [modelInfo, setModelInfo] = useState<{ displayName?: string; fallback?: boolean }>({});
  const [initialResult, setInitialResult] = useState<GradeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedAttemptId, setSavedAttemptId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError(null);
      setInitialResult(null);
      setSavedAttemptId(null);

      if (attemptId) {
        try {
          const [attemptResponse, setResponse] = await Promise.all([
            fetch(`/api/attempts/${attemptId}`),
            setId && setId !== SAMPLE_QUESTION_SET_ID ? fetch(`/api/question-sets/${setId}`) : Promise.resolve(null),
          ]);
          const payload = (await attemptResponse.json()) as (GradeResponse & { questionSetId?: string }) & { error?: string };
          if (!attemptResponse.ok) throw new Error(payload.error ?? "풀이 결과를 불러오지 못했습니다.");
          if (cancelled) return;
          const set = setResponse ? await loadQuestionSetResponse<LoadedQuestionSet>(setResponse) : await loadQuestionSet(payload.questionSetId ?? setId ?? undefined);
          if (cancelled || !set) throw new Error("문제 세트를 찾을 수 없습니다.");
          setInitialResult(payload);
          setSavedAttemptId(payload.attemptId);
          setQuestions(set.questions);
          setDocumentName(set.documentName);
          setQuestionSetId(set.questionSetId);
          setModelInfo({ displayName: set.generatedModelName, fallback: set.generatedFallback });
        } catch (loadError) {
          if (cancelled) return;
          setError(loadError instanceof Error ? loadError.message : "풀이 결과를 불러오지 못했습니다.");
          setQuestions([]);
        }
        return;
      }

      if (setId && setId !== SAMPLE_QUESTION_SET_ID) {
        const set = await loadQuestionSet(setId);
        if (cancelled) return;
        if (set) {
          setQuestions(set.questions);
          setDocumentName(set.documentName);
          setQuestionSetId(set.questionSetId);
          setModelInfo({ displayName: set.generatedModelName, fallback: set.generatedFallback });
        } else {
          setError("문제 세트를 찾을 수 없습니다.");
          setQuestions([]);
        }
        return;
      }

      // Default: the built-in sample exam (same data the old homepage practice section used).
      setQuestions(sampleQuestions.map(toQuizQuestion));
      setDocumentName(SAMPLE_DOCUMENT_NAME);
      setQuestionSetId(SAMPLE_QUESTION_SET_ID);
      setModelInfo({});
    }

    void load();
    return () => { cancelled = true; };
  }, [attemptId, setId]);

  const handleGraded = useCallback((result: GradeResponse) => {
    setSavedAttemptId(result.attemptId);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `/exam?attempt=${result.attemptId}`);
    }
  }, []);

  if (questions === null) {
    return (
      <div className="exam-shell">
        <TopBar documentName={documentName} />
        <main className="exam-loading">{error ? <span role="alert">{error}</span> : "시험을 불러오는 중..."}</main>
      </div>
    );
  }

  if (error && !questions.length) {
    return (
      <div className="exam-shell">
        <TopBar documentName={documentName} />
        <main className="exam-loading" role="alert">
          <p>{error}</p>
          <Link className="secondary-button" href="/#library">문제은행으로 돌아가기</Link>
        </main>
      </div>
    );
  }

  // PREVIEW MODE: read-only confirmation between generation and solving.
  if (preview) {
    return (
      <GeneratedPreview
        set={{
          questionSetId: questionSetId || setId || "",
          documentName,
          generatedModelName: modelInfo.displayName,
          generatedFallback: modelInfo.fallback,
          questions,
        }}
      />
    );
  }

  return (
    <div className="exam-shell">
      <TopBar documentName={documentName} savedAttemptId={savedAttemptId} modelInfo={modelInfo} />
      <main className="exam-main">
        <QuizSession
          key={`${questions.map((question) => question.id).join("-")}-${initialResult?.attemptId ?? "new"}`}
          questions={questions}
          questionSetId={questionSetId}
          documentName={documentName}
          initialGradeResult={initialResult}
          onGraded={handleGraded}
        />
      </main>
    </div>
  );
}

async function loadQuestionSet(id: string | undefined): Promise<LoadedQuestionSet | null> {
  if (!id) return null;
  try {
    const response = await fetch(`/api/question-sets/${id}`);
    return await loadQuestionSetResponse<LoadedQuestionSet>(response);
  } catch {
    return null;
  }
}

async function loadQuestionSetResponse<T extends LoadedQuestionSet>(response: Response): Promise<T | null> {
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "문제 세트를 불러오지 못했습니다.");
  return payload;
}

function TopBar({ documentName, savedAttemptId, modelInfo }: { documentName: string; savedAttemptId?: string | null; modelInfo?: { displayName?: string; fallback?: boolean } }) {
  return (
    <header className="topbar exam-topbar">
      <Link className="brand" href="/" aria-label="PDF2Exam 홈">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/pdf2exam-logo.png" alt="PDF2Exam" className="brand-logo" />
      </Link>
      <div className="exam-topbar-meta" title={documentName}>
        {documentName && <span className="exam-doc-name">{documentName}</span>}
        {modelInfo?.displayName && (
          <span className="exam-model-badge" title="이 문제를 생성한 AI 모델">
            {modelInfo.displayName}
            {modelInfo.fallback && <em>· Fallback</em>}
          </span>
        )}
        {savedAttemptId && <span className="exam-saved-badge">저장됨</span>}
      </div>
      <nav aria-label="시험 메뉴">
        <Link href="/">종료</Link>
        <AuthMenu />
      </nav>
    </header>
  );
}
