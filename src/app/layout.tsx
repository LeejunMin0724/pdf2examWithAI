import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "시험노트 | PDF 기반 문제은행",
  description: "강의 PDF에서 시험 대비 문제를 만들고 풀어보는 개인 학습 도구",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        {children}
      </body>
    </html>
  );
}
