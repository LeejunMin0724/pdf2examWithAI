"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { type QuizQuestion } from "@/lib/questions";
import { useAuth } from "@/components/auth-provider";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { isSupabaseConfigured } from "@/lib/supabase-env";
import { MAX_PDF_SIZE_BYTES, MAX_PDF_SIZE_MB } from "@/lib/pdf-limits";
import { DIRECT_UPLOAD_THRESHOLD_BYTES, PDF_STORAGE_BUCKET, pdfStoragePath, translateStorageUploadError } from "@/lib/pdf-storage";

type UploadResult = { documentId: string; originalName: string; pageCount: number; extractedCharacterCount: number };
type GeneratedResult = { questionSetId: string; questions: QuizQuestion[]; displayName?: string; fallback?: boolean };
type ModelPreview = { available: boolean; displayName?: string; fallback?: boolean; fallbackReason?: string };
export type PreviewState = { questionSetId: string; documentName: string; questions: QuizQuestion[] };
type PdfUploadProps = {
  onQuestionsGenerated?: (questions: QuizQuestion[], documentName: string, questionSetId: string) => void;
  /** Rendered after a successful generation instead of auto-navigating to the exam. */
  onGenerated?: (preview: PreviewState) => void;
};

function friendlyGenerateError(raw: string) {
  // The pool walks every model in quality order; a 429 from the last one means
  // all models are exhausted/overloaded right now — give the user an honest,
  // actionable message instead of raw provider errors.
  if (/\b429\b/.test(raw) || raw.includes("사용 가능한 Gemini 모델이 없습니다")) {
    return "지금 사용 가능한 AI 모델의 한도가 모두 소진되었습니다. 잠시 후(또는 하루가 지나면) 다시 시도해 주세요.";
  }
  if (/\b503\b/.test(raw)) {
    return "AI 모델이 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해 주세요.";
  }
  return raw;
}

export function PdfUpload({ onQuestionsGenerated, onGenerated }: PdfUploadProps) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [generated, setGenerated] = useState<GeneratedResult | null>(null);
  const [questionType, setQuestionType] = useState("MULTIPLE_CHOICE");
  const [count, setCount] = useState("5");
  const [difficulty, setDifficulty] = useState("EASY");
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [modelPreview, setModelPreview] = useState<ModelPreview | null>(null);

  const refreshModelPreview = useCallback(() => {
    fetch("/api/model-preview")
      .then(async (response) => (await response.json()) as ModelPreview)
      .then(setModelPreview)
      .catch(() => setModelPreview(null));
  }, []);

  // Which model the NEXT generation will use — shown before the user clicks.
  useEffect(() => {
    if (!result || generated) return;
    refreshModelPreview();
  }, [result, generated, refreshModelPreview]);

  function chooseFile(file: File | undefined | null) {
    if (!file) return;
    if (file.type !== "application/pdf") {
      setError("PDF 파일만 업로드할 수 있습니다.");
      return;
    }
    if (file.size > MAX_PDF_SIZE_BYTES) {
      setError(`PDF는 최대 ${MAX_PDF_SIZE_MB}MB까지 업로드할 수 있습니다.`);
      return;
    }
    setError(null);
    setSelectedFile(file);
  }

  /** Small files: a single multipart request through this app's own route. */
  async function uploadThroughApi(file: File): Promise<UploadResult> {
    const formData = new FormData();
    formData.set("file", file);
    const response = await fetch("/api/documents/upload", { method: "POST", body: formData });
    const payload = (await response.json().catch(() => null)) as (UploadResult & { error?: string }) | null;
    if (!response.ok) {
      if (response.status === 413) throw new Error("파일이 너무 커서 전송되지 않았습니다. 로그인 후 다시 시도해 주세요.");
      throw new Error(payload?.error ?? "업로드에 실패했습니다.");
    }
    return payload as UploadResult;
  }

  /**
   * Large files: the browser uploads straight to Supabase Storage and the server
   * fetches it back for parsing. Hosted functions cap the request body at 4.5MB,
   * so a PDF this size can never travel through our own API route.
   */
  async function uploadThroughStorage(file: File): Promise<UploadResult> {
    if (!user) throw new Error(`4MB를 넘는 PDF는 로그인한 뒤 업로드할 수 있습니다. (최대 ${MAX_PDF_SIZE_MB}MB)`);
    const supabase = createSupabaseBrowserClient();
    const storagePath = pdfStoragePath(user.id, crypto.randomUUID());
    const { error: storageError } = await supabase.storage
      .from(PDF_STORAGE_BUCKET)
      .upload(storagePath, file, { contentType: "application/pdf", upsert: false });
    if (storageError) throw new Error(translateStorageUploadError(storageError.message));

    const response = await fetch("/api/documents/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storagePath, originalName: file.name }),
    });
    const payload = (await response.json().catch(() => null)) as (UploadResult & { error?: string }) | null;
    if (!response.ok) throw new Error(payload?.error ?? "업로드에 실패했습니다.");
    return payload as UploadResult;
  }

  async function upload() {
    if (!selectedFile) return;
    setError(null);
    setResult(null);
    setGenerated(null);
    setIsUploading(true);
    try {
      const useStorage = selectedFile.size > DIRECT_UPLOAD_THRESHOLD_BYTES && isSupabaseConfigured();
      setResult(useStorage ? await uploadThroughStorage(selectedFile) : await uploadThroughApi(selectedFile));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "업로드에 실패했습니다.");
    } finally {
      setIsUploading(false);
    }
  }

  async function generateQuestions() {
    if (!result) return;
    setError(null);
    setGenerated(null);
    setIsGenerating(true);
    try {
      const response = await fetch("/api/question-sets/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: result.documentId, questionType, count: Number(count), difficulty }),
      });
      const payload = (await response.json()) as GeneratedResult & { error?: string };
      if (!response.ok) throw new Error(friendlyGenerateError(payload.error ?? "문제 생성에 실패했습니다."));
      onQuestionsGenerated?.(payload.questions, result.originalName, payload.questionSetId);
      // NEW FLOW: stay here and hand off to the read-only preview screen.
      // The exam (timer/answering) starts only after [생성된 문제 풀기] —
      // questions are persisted server-side and reloaded there by set id.
      setGenerated(payload);
      onGenerated?.({ questionSetId: payload.questionSetId, documentName: result.originalName, questions: payload.questions });
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "문제 생성에 실패했습니다.");
      refreshModelPreview(); // quota state just changed — re-fetch for the retry
    } finally {
      setIsGenerating(false);
    }
  }

  return <section className="upload-workspace" aria-label="PDF 업로드">
    <input accept="application/pdf,.pdf" className="visually-hidden" onChange={(event) => chooseFile(event.target.files?.[0])} ref={inputRef} type="file" />

    {!result && <div
      className={`dropzone ${isDragging ? "dragging" : ""}`}
      onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => { event.preventDefault(); setIsDragging(false); chooseFile(event.dataTransfer.files?.[0]); }}
    >
      <p className="dropzone-icon" aria-hidden="true">↥</p>
      <p className="dropzone-title">{selectedFile ? selectedFile.name : "PDF 파일을 끌어다 놓거나 선택하세요"}</p>
      <p className="dropzone-hint">텍스트 기반 PDF · 최대 {MAX_PDF_SIZE_MB}MB · 200페이지</p>
      {selectedFile && selectedFile.size > DIRECT_UPLOAD_THRESHOLD_BYTES && !result && (
        <p className="dropzone-hint">큰 파일은 {user ? "저장소로 전송" : "로그인 후 업로드"}됩니다</p>
      )}
      <button className="btn btn-secondary" onClick={() => inputRef.current?.click()} type="button">파일 선택</button>
    </div>}

    {!result && <button className="btn btn-primary btn-block" disabled={!selectedFile || isUploading} onClick={upload} type="button">{isUploading ? "텍스트 추출 중..." : "업로드하고 분석하기"}</button>}

    {error && <p className="upload-error" role="alert">{error}</p>}

    {result && <div className="upload-success" aria-live="polite">
      <strong>{result.originalName}</strong>
      <span>{result.pageCount}페이지 · {result.extractedCharacterCount.toLocaleString()}자 추출 완료</span>

      {!generated && <>
        <div className="generation-controls">
          <label>문제 유형<select value={questionType} onChange={(event) => setQuestionType(event.target.value)}><option value="MULTIPLE_CHOICE">객관식</option><option value="SUBJECTIVE">서술형</option></select></label>
          <label>문제 수<select value={count} onChange={(event) => setCount(event.target.value)}><option value="3">3개</option><option value="5">5개</option><option value="10">10개</option></select></label>
          <label>난이도<select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option value="EASY">쉬움</option><option value="HARD">어려움</option></select></label>
        </div>
        {modelPreview?.available && modelPreview.displayName && <p className="model-preview" role="status">
          사용 모델: <strong>{modelPreview.displayName}</strong>
          {modelPreview.fallback && <em> · {modelPreview.fallbackReason ?? "상위 모델 일시 사용 불가"}</em>}
        </p>}
        <button className="btn btn-primary btn-block" disabled={isGenerating} onClick={generateQuestions} type="button">{isGenerating ? "문제를 만들고 있어요. 잠시만 기다려 주세요..." : "문제 생성하기"}</button>
      </>}

      {generated && <p className="generation-complete" role="status">{generated.displayName ? `${generated.displayName}로 문제 생성 완료` : "문제 생성 완료"} — 생성된 문제를 확인하는 중...</p>}
    </div>}
  </section>;
}
