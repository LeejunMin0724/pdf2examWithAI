import { Suspense } from "react";
import { ExamClient } from "./exam-client";

export const metadata = {
  title: "시험 풀이 | 시험노트",
  description: "생성된 문제를 풀고 AI 채점 결과를 확인하는 시험 화면",
};

export default function ExamPage() {
  return (
    <Suspense fallback={<div className="exam-loading">시험을 불러오는 중...</div>}>
      <ExamClient />
    </Suspense>
  );
}
