import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/components/auth-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "PDF2Exam | PDF 기반 문제은행",
  description: "강의 PDF에서 시험 대비 문제를 만들고 풀어보는 개인 학습 도구",
};

/* viewport-fit=cover: the page owns the iPhone status-bar/notch strip, so iOS
   exposes it through env(safe-area-inset-top) and the sticky topbar can reserve
   it itself. Without this the inset is always 0 and Safari parks the bar under
   the status bar (logo behind the clock). */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
